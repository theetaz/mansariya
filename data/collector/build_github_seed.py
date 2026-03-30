#!/usr/bin/env python3
"""
Build seed data from GitHub dataset only (clean, GPS-verified data).

Source: github_colombo.json — 22 routes, 31 patterns, 143 GPS-verified places.
Enrichment: KNOWN_ROUTES from fix_and_enrich.py for trilingual names.
Polylines: OSRM public instance for road-snapped routes.

Output: ../seed_data.json
"""

import json
import os
import re
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent
GITHUB_PATH = BASE_DIR / "github_colombo.json"
TRANSLATIONS_PATH = BASE_DIR / "stop_translations.json"
FIX_ENRICH_PATH = BASE_DIR / "fix_and_enrich.py"
OUTPUT_PATH = DATA_DIR / "seed_data.json"
OSRM_BASE = "https://router.project-osrm.org"


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')


def extract_known_routes() -> dict:
    with open(FIX_ENRICH_PATH) as f:
        content = f.read()
    start = content.index('KNOWN_ROUTES = {')
    depth = 0
    for i in range(start, len(content)):
        if content[i] == '{': depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                block = content[start:i + 1]
                break
    local_vars = {}
    exec(block, {}, local_vars)
    return local_vars['KNOWN_ROUTES']


def get_osrm_polyline(coords: list[tuple[float, float]]) -> list[list[float]]:
    """Call OSRM to get road-snapped polyline. coords = [(lng, lat), ...]"""
    if len(coords) < 2:
        return [[c[0], c[1]] for c in coords]

    coord_str = ';'.join(f'{lng},{lat}' for lng, lat in coords)
    url = f'{OSRM_BASE}/route/v1/driving/{coord_str}?overview=full&geometries=geojson'

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mansariya/1.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            if data.get('code') == 'Ok' and data.get('routes'):
                return data['routes'][0]['geometry']['coordinates']
    except Exception as e:
        print(f"    OSRM failed: {e}")

    # Fallback: straight lines
    return [[c[0], c[1]] for c in coords]


def main():
    print("\n  ━━━ Mansariya Seed — GitHub Only ━━━\n")

    # Load sources
    with open(GITHUB_PATH) as f:
        github = json.load(f)
    with open(TRANSLATIONS_PATH) as f:
        translations = json.load(f)
    known_routes = extract_known_routes()

    places = {p['id']: p for p in github['places']}
    print(f"  GitHub: {len(github['routes'])} routes, {len(places)} places")
    print(f"  Translations: {len(translations)} stop names (SI/TA)")
    print(f"  KNOWN_ROUTES: {len(known_routes)} entries")

    # Build stops from GitHub places with trilingual names
    all_stops: dict[str, dict] = {}
    translated_count = 0
    for p in places.values():
        if not p.get('lat') or not p.get('lng'):
            continue
        sid = f"gh_{p['id']}"
        tr = translations.get(p['name'], {})
        if tr:
            translated_count += 1
        all_stops[sid] = {
            'id': sid,
            'name_en': p['name'],
            'name_si': tr.get('si', ''),
            'name_ta': tr.get('ta', ''),
            'lat': p['lat'], 'lng': p['lng'],
            'source': 'github',
        }
    print(f"  Translated: {translated_count}/{len(all_stops)} stops have SI/TA names")

    # Group routes by route_no, collect all variants
    route_buses: dict[str, list] = defaultdict(list)
    for r in github['routes']:
        if r['bus_id'] > 100:
            continue
        rno = r['route_no']
        bus_stops = sorted(
            [s for s in github['stops'] if s['bus_id'] == r['bus_id']],
            key=lambda x: x['stop_order'],
        )
        route_buses[rno].append({
            'bus_id': r['bus_id'],
            'from': r['from'],
            'to': r['to'],
            'stops': bus_stops,
        })

    # Build routes, patterns, pattern_stops
    routes = []
    patterns = []
    pattern_stops_list = []
    used_ids: set[str] = set()

    print(f"\n  Building {len(route_buses)} routes with OSRM polylines...\n")

    # Extra route translations not in KNOWN_ROUTES
    extra_routes: dict[str, tuple[str, str, str, str, str]] = {
        "138/2": ("Pettah - Mattegoda", "පිටකොටුව - මත්තේගොඩ", "புறக்கோட்டை - மத்தேகொடை", "Private", "Normal"),
        "138/3": ("Pettah - Rukmalgama", "පිටකොටුව - රුක්මල්ගම", "புறக்கோட்டை - ருக்மல்கம", "Private", "Normal"),
        "138/4": ("Pettah - Athurugiriya", "පිටකොටුව - අතුරුගිරිය", "புறக்கோட்டை - அதுருகிரிய", "Private", "Normal"),
    }

    for rno, variants in sorted(route_buses.items(), key=lambda x: x[0]):
        # Route metadata: KNOWN_ROUTES → extra_routes → generate from GitHub
        kr = known_routes.get(rno) or extra_routes.get(rno)
        if kr:
            name_en, name_si, name_ta, operator, service_type = kr
        else:
            longest = max(variants, key=lambda v: len(v['stops']))
            name_en = f"{longest['from']} - {longest['to']}"
            name_si, name_ta = '', ''
            operator, service_type = 'Private', 'Normal'

        routes.append({
            'id': rno,
            'name_en': name_en, 'name_si': name_si, 'name_ta': name_ta,
            'operator': operator, 'service_type': service_type,
            'fare_lkr': 0, 'frequency_minutes': 0, 'operating_hours': '',
        })

        # Find primary (longest variant)
        longest_idx = max(range(len(variants)), key=lambda i: len(variants[i]['stops']))

        for i, variant in enumerate(variants):
            if len(variant['stops']) == 0:
                continue

            dest_slug = slugify(variant['to'])
            pattern_id = f"rt_{rno}_{dest_slug}"
            if pattern_id in used_ids:
                pattern_id = f"rt_{rno}_{dest_slug}_{i}"
            used_ids.add(pattern_id)

            is_primary = (i == longest_idx)

            # Build stop entries and collect coords for OSRM
            stop_entries = []
            stop_coords = []
            for s in variant['stops']:
                if s['place_id'] not in places:
                    continue
                p = places[s['place_id']]
                sid = f"gh_{s['place_id']}"
                stop_entries.append({
                    'pattern_id': pattern_id,
                    'stop_id': sid,
                    'stop_order': s['stop_order'] - 1,
                })
                stop_coords.append((p['lng'], p['lat']))

            if len(stop_entries) < 2:
                continue

            # Get OSRM polyline
            print(f"  {rno} → {variant['to']} ({len(stop_entries)} stops)", end='')
            polyline = get_osrm_polyline(stop_coords)
            print(f" → {len(polyline)} polyline points")

            patterns.append({
                'id': pattern_id,
                'route_id': rno,
                'headsign': variant['to'],
                'direction': 0,
                'is_primary': is_primary,
                'stop_count': len(stop_entries),
                'source': 'github',
                'polyline': polyline,
            })
            pattern_stops_list.extend(stop_entries)

            # Rate limit OSRM
            time.sleep(0.5)

    # Build backward-compat route_stops from primary patterns
    route_stops_list = []
    for pattern in patterns:
        if not pattern['is_primary']:
            continue
        for ps in pattern_stops_list:
            if ps['pattern_id'] == pattern['id']:
                route_stops_list.append({
                    'route_id': pattern['route_id'],
                    'stop_id': ps['stop_id'],
                    'stop_order': ps['stop_order'],
                })

    # Load timetables for matching routes
    timetable_entries = []
    timetables_path = DATA_DIR / "timetables.json"
    if timetables_path.exists():
        with open(timetables_path) as f:
            timetables = json.load(f)
        route_ids = {r['id'] for r in routes}
        for rid, tt in timetables.items():
            if rid not in route_ids:
                continue
            for entry in tt.get('entries', []):
                dep = entry.get('departure_time', '')
                if not dep:
                    continue
                parts = dep.strip().split(':')
                if len(parts) == 2:
                    dep = f"{int(parts[0]):02d}:{int(parts[1]):02d}"
                timetable_entries.append({
                    'route_id': rid,
                    'departure_time': dep,
                    'days': ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
                    'service_type': entry.get('service_type', 'Normal') or 'Normal',
                })

    # Output
    seed_data = {
        'routes': sorted(routes, key=lambda r: r['id']),
        'stops': list(all_stops.values()),
        'route_patterns': [{k: v for k, v in p.items() if k != 'polyline'} for p in patterns],
        'pattern_polylines': {p['id']: p['polyline'] for p in patterns if p.get('polyline')},
        'pattern_stops': pattern_stops_list,
        'route_stops': route_stops_list,
        'timetables': timetable_entries,
    }

    with open(OUTPUT_PATH, 'w') as f:
        json.dump(seed_data, f, indent=2, ensure_ascii=False)

    multi = sum(1 for v in route_buses.values() if len(v) > 1)
    total_patterns = sum(1 for p in patterns)
    print(f"\n  ━━━ Summary ━━━")
    print(f"  Routes:       {len(routes)}")
    print(f"  Stops:        {len(all_stops)} (GPS-verified)")
    print(f"  Patterns:     {total_patterns} ({multi} multi-variant)")
    print(f"  Route stops:  {len(route_stops_list)}")
    print(f"  Timetables:   {len(timetable_entries)}")
    print(f"  Output:       {OUTPUT_PATH}\n")


if __name__ == '__main__':
    main()
