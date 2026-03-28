#!/usr/bin/env python3
"""
Mansariya Seed Data Builder
============================
Rebuilds the complete seed dataset from all raw sources, handling
multi-variant routes properly.

Sri Lankan bus routes can have multiple trip patterns under the same
route number (e.g., route 138 has variants to Homagama, Kottawa, and
Maharagama). Previous merge scripts only kept the first variant.
This script processes ALL variants.

Data sources:
  - github_colombo.json     (GPS-verified stops, 22 routes, 7 multi-variant)
  - routemaster_routes.json (112 routes with waypoints)
  - ../osm_bus_stops.json   (4000+ OSM bus stops)
  - ntc_permits_parsed.json (461 NTC route permits)
  - ../timetables.json      (50 routes, 1800+ timetable entries)
  - fix_and_enrich.py       (KNOWN_ROUTES dict with trilingual metadata)

Output:
  ../seed_data.json
"""

import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent          # data/collector/
DATA_DIR = BASE_DIR.parent                          # data/

GITHUB_PATH = BASE_DIR / "github_colombo.json"
ROUTEMASTER_PATH = BASE_DIR / "routemaster_routes.json"
OSM_STOPS_PATH = DATA_DIR / "osm_bus_stops.json"
NTC_PATH = BASE_DIR / "ntc_permits_parsed.json"
TIMETABLES_PATH = DATA_DIR / "timetables.json"
FIX_ENRICH_PATH = BASE_DIR / "fix_and_enrich.py"
OUTPUT_PATH = DATA_DIR / "seed_data.json"


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    """Convert text to a URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')


def normalize_route_no(route_no: str) -> str:
    """Strip leading zeros: '001' -> '1', '01' -> '1'."""
    return route_no.lstrip('0') or '0'


def normalize_time(time_str: str) -> str:
    """'3:00' -> '03:00', '14:30' -> '14:30'."""
    if not time_str:
        return ''
    parts = time_str.strip().split(':')
    if len(parts) != 2:
        return ''
    try:
        h, m = int(parts[0]), int(parts[1])
        return f"{h:02d}:{m:02d}"
    except ValueError:
        return ''


def load_json(path: Path) -> dict | list:
    """Load a JSON file, exiting on error."""
    if not path.exists():
        print(f"  ERROR: missing file {path}")
        sys.exit(1)
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def extract_known_routes() -> dict:
    """
    Extract the KNOWN_ROUTES dict from fix_and_enrich.py.

    Returns a dict mapping route_id -> (name_en, name_si, name_ta, operator, service_type).
    """
    content = FIX_ENRICH_PATH.read_text(encoding='utf-8')

    # Find the start of the KNOWN_ROUTES assignment
    marker = 'KNOWN_ROUTES = {'
    start = content.index(marker)

    # Walk forward to find the matching closing brace
    depth = 0
    end = start
    for i in range(start, len(content)):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    block = content[start:end]

    # Execute the isolated block to obtain the dict
    local_vars: dict = {}
    exec(block, {}, local_vars)  # noqa: S102
    return local_vars['KNOWN_ROUTES']


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------

def main() -> None:
    print("\n  ━━━ Mansariya Seed Data Builder ━━━\n")
    print("  Loading sources ...")

    # ------------------------------------------------------------------
    # 1. Load all sources
    # ------------------------------------------------------------------
    github = load_json(GITHUB_PATH)
    routemaster = load_json(ROUTEMASTER_PATH)
    osm_stops_raw = load_json(OSM_STOPS_PATH)
    ntc = load_json(NTC_PATH)
    timetables = load_json(TIMETABLES_PATH)
    known_routes = extract_known_routes()

    print(f"    github_colombo.json    : {len(github['routes'])} routes, "
          f"{len(github['places'])} places, {len(github['stops'])} stop-links")
    print(f"    routemaster_routes.json: {len(routemaster)} routes")
    print(f"    osm_bus_stops.json     : {len(osm_stops_raw)} stops")
    print(f"    ntc_permits_parsed.json: {len(ntc)} permits")
    print(f"    timetables.json        : {len(timetables)} routes")
    print(f"    KNOWN_ROUTES           : {len(known_routes)} entries")

    # ------------------------------------------------------------------
    # 2. Build stops registry (dedup by name + proximity)
    # ------------------------------------------------------------------
    all_stops: dict[str, dict] = {}

    # Add GitHub places as stops
    for place in github['places']:
        stop_id = f"gh_{place['id']}"
        all_stops[stop_id] = {
            'id': stop_id,
            'name_en': place['name'],
            'name_si': '',
            'name_ta': '',
            'lat': place['lat'],
            'lng': place['lng'],
            'source': 'github',
        }

    # Add OSM stops
    for s in osm_stops_raw:
        stop_id = f"osm_{s['osm_id']}"
        all_stops[stop_id] = {
            'id': stop_id,
            'name_en': s.get('name_en') or s.get('name', ''),
            'name_si': s.get('name_si', ''),
            'name_ta': s.get('name_ta', ''),
            'lat': s['lat'],
            'lng': s['lng'],
            'source': 'osm',
        }

    # ------------------------------------------------------------------
    # 3. Build route registry from all sources
    # ------------------------------------------------------------------
    routes: dict[str, dict] = {}

    # Start with KNOWN_ROUTES (highest priority for metadata)
    for rid, (name_en, name_si, name_ta, operator, stype) in known_routes.items():
        routes[rid] = {
            'id': rid,
            'name_en': name_en,
            'name_si': name_si,
            'name_ta': name_ta,
            'operator': operator,
            'service_type': stype,
            'fare_lkr': 0,
            'frequency_minutes': 0,
            'operating_hours': '',
        }

    # Enrich from NTC permits (add missing routes)
    for n in ntc:
        rid = normalize_route_no(n['route_no'])
        if rid not in routes:
            routes[rid] = {
                'id': rid,
                'name_en': f"{n['origin'].title()} - {n['destination'].title()}",
                'name_si': '',
                'name_ta': '',
                'operator': '',
                'service_type': (n.get('service_type') or 'Normal').title(),
                'fare_lkr': 0,
                'frequency_minutes': 0,
                'operating_hours': '',
            }

    # Enrich from GitHub routes (add any not already present)
    for r in github['routes']:
        if r['bus_id'] > 100:
            continue  # skip reverse/inbound duplicates
        rid = r['route_no']
        if rid not in routes:
            routes[rid] = {
                'id': rid,
                'name_en': f"{r['from']} - {r['to']}",
                'name_si': '',
                'name_ta': '',
                'operator': 'Private',
                'service_type': 'Normal',
                'fare_lkr': 0,
                'frequency_minutes': 0,
                'operating_hours': '',
            }

    # Enrich from Routemaster (add missing routes)
    seen_rm_routes: set[str] = set()
    for r in routemaster:
        rid = r.get('route_no', '')
        if not rid or rid in routes or rid in seen_rm_routes:
            continue
        seen_rm_routes.add(rid)
        routes[rid] = {
            'id': rid,
            'name_en': r.get('name', ''),
            'name_si': '',
            'name_ta': '',
            'operator': '',
            'service_type': 'Normal',
            'fare_lkr': 0,
            'frequency_minutes': 0,
            'operating_hours': '',
        }

    # ------------------------------------------------------------------
    # 4. Build patterns from GitHub (the key improvement: ALL variants)
    # ------------------------------------------------------------------
    patterns: list[dict] = []
    pattern_stops_list: list[dict] = []
    used_pattern_ids: set[str] = set()

    places_map: dict[int, dict] = {p['id']: p for p in github['places']}

    # Group GitHub outbound routes by route_no
    route_buses: dict[str, list[dict]] = defaultdict(list)
    for r in github['routes']:
        if r['bus_id'] > 100:
            continue  # skip reverse/inbound

        # Get ordered stops for this bus_id
        bus_stops = sorted(
            [s for s in github['stops'] if s['bus_id'] == r['bus_id']],
            key=lambda x: x['stop_order'],
        )

        route_buses[r['route_no']].append({
            'bus_id': r['bus_id'],
            'from': r['from'],
            'to': r['to'],
            'stops': bus_stops,
        })

    # Create patterns for each GitHub route variant
    for route_no, variants in route_buses.items():
        # Find the variant with the most stops -> primary
        longest_idx = max(range(len(variants)), key=lambda i: len(variants[i]['stops']))

        for i, variant in enumerate(variants):
            dest_slug = slugify(variant['to'])
            pattern_id = f"rt_{route_no}_{dest_slug}"

            # Ensure unique pattern IDs
            if pattern_id in used_pattern_ids:
                pattern_id = f"rt_{route_no}_{dest_slug}_{variant['bus_id']}"
            used_pattern_ids.add(pattern_id)

            is_primary = (i == longest_idx)

            stop_entries: list[dict] = []
            for s in variant['stops']:
                if s['place_id'] not in places_map:
                    continue
                stop_id = f"gh_{s['place_id']}"
                stop_entries.append({
                    'pattern_id': pattern_id,
                    'stop_id': stop_id,
                    'stop_order': s['stop_order'] - 1,  # 0-indexed
                })

            patterns.append({
                'id': pattern_id,
                'route_id': route_no,
                'headsign': variant['to'],
                'direction': 0,
                'is_primary': is_primary,
                'stop_count': len(stop_entries),
                'source': 'github',
            })
            pattern_stops_list.extend(stop_entries)

    # ------------------------------------------------------------------
    # Create patterns for routes NOT in GitHub (Routemaster / metadata)
    # ------------------------------------------------------------------
    github_route_ids: set[str] = set(route_buses.keys())

    # Build a lookup for routemaster data (first entry per route_no wins)
    rm_by_route: dict[str, dict] = {}
    for r in routemaster:
        rno = r.get('route_no', '')
        if rno and rno not in rm_by_route:
            rm_by_route[rno] = r

    for rid, route in routes.items():
        if rid in github_route_ids:
            continue

        rm = rm_by_route.get(rid)
        if rm and rm.get('waypoints'):
            # Create stops from Routemaster waypoints
            waypoints = rm['waypoints']
            dest = (
                waypoints[-1]['name']
                if waypoints
                else route['name_en'].split(' - ')[-1].strip()
                if ' - ' in route['name_en']
                else route['name_en']
            )
            dest_slug = slugify(dest)
            pattern_id = f"rt_{rid}_{dest_slug}"

            # Ensure unique pattern ID
            if pattern_id in used_pattern_ids:
                pattern_id = f"rt_{rid}_{dest_slug}_rm"
            used_pattern_ids.add(pattern_id)

            wp_stops: list[dict] = []
            for j, wp in enumerate(waypoints):
                wp_stop_id = f"rm_{rid}_{j}"
                all_stops[wp_stop_id] = {
                    'id': wp_stop_id,
                    'name_en': wp.get('name', f'Waypoint {j}'),
                    'name_si': '',
                    'name_ta': '',
                    'lat': wp['lat'],
                    'lng': wp['lng'],
                    'source': 'routemaster',
                }
                wp_stops.append({
                    'pattern_id': pattern_id,
                    'stop_id': wp_stop_id,
                    'stop_order': j,
                })

            if wp_stops:
                patterns.append({
                    'id': pattern_id,
                    'route_id': rid,
                    'headsign': dest,
                    'direction': 0,
                    'is_primary': True,
                    'stop_count': len(wp_stops),
                    'source': 'routemaster',
                })
                pattern_stops_list.extend(wp_stops)
        else:
            # No stop data -- create a metadata-only pattern (if name exists)
            name = route['name_en']
            if not name:
                continue  # skip routes with no name and no stops

            dest = name.split(' - ')[-1].strip() if ' - ' in name else name
            if not dest:
                continue

            dest_slug = slugify(dest)
            pattern_id = f"rt_{rid}_{dest_slug}"

            if pattern_id in used_pattern_ids:
                pattern_id = f"rt_{rid}_{dest_slug}_meta"
            used_pattern_ids.add(pattern_id)

            patterns.append({
                'id': pattern_id,
                'route_id': rid,
                'headsign': dest,
                'direction': 0,
                'is_primary': True,
                'stop_count': 0,
                'source': 'metadata',
            })

    # ------------------------------------------------------------------
    # 5. Build backward-compat route_stops from primary patterns
    # ------------------------------------------------------------------
    # Build a quick lookup: pattern_id -> list of pattern_stop entries
    ps_by_pattern: dict[str, list[dict]] = defaultdict(list)
    for ps in pattern_stops_list:
        ps_by_pattern[ps['pattern_id']].append(ps)

    route_stops_list: list[dict] = []
    for pattern in patterns:
        if not pattern['is_primary']:
            continue
        for ps in ps_by_pattern[pattern['id']]:
            route_stops_list.append({
                'route_id': pattern['route_id'],
                'stop_id': ps['stop_id'],
                'stop_order': ps['stop_order'],
            })

    # ------------------------------------------------------------------
    # 6. Process timetables
    # ------------------------------------------------------------------
    all_days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    timetable_entries: list[dict] = []

    for route_id, tt_data in timetables.items():
        rid = normalize_route_no(route_id)
        if rid not in routes:
            continue
        for entry in tt_data.get('entries', []):
            dep_time = normalize_time(entry.get('departure_time', ''))
            if not dep_time:
                continue
            timetable_entries.append({
                'route_id': rid,
                'departure_time': dep_time,
                'days': all_days,
                'service_type': entry.get('service_type') or 'Normal',
            })

    # ------------------------------------------------------------------
    # 7. Only include routes that have patterns
    # ------------------------------------------------------------------
    routes_with_patterns: set[str] = {p['route_id'] for p in patterns}
    final_routes = [r for r in routes.values() if r['id'] in routes_with_patterns]

    # ------------------------------------------------------------------
    # 8. Output
    # ------------------------------------------------------------------
    seed_data = {
        'routes': sorted(final_routes, key=lambda r: _route_sort_key(r['id'])),
        'stops': sorted(all_stops.values(), key=lambda s: s['id']),
        'route_patterns': patterns,
        'pattern_stops': pattern_stops_list,
        'route_stops': route_stops_list,
        'timetables': timetable_entries,
    }

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(seed_data, f, indent=2, ensure_ascii=False)

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------
    multi_variant = sum(1 for buses in route_buses.values() if len(buses) > 1)
    github_patterns = sum(1 for p in patterns if p['source'] == 'github')
    rm_patterns = sum(1 for p in patterns if p['source'] == 'routemaster')
    meta_patterns = sum(1 for p in patterns if p['source'] == 'metadata')

    gh_stops = sum(1 for s in all_stops.values() if s['source'] == 'github')
    osm_stops = sum(1 for s in all_stops.values() if s['source'] == 'osm')
    rm_stops = sum(1 for s in all_stops.values() if s['source'] == 'routemaster')

    print(f"\n  ━━━ Build Complete ━━━\n")
    print(f"  Routes:            {len(final_routes)}")
    print(f"  Stops:             {len(all_stops):,}")
    print(f"    github:          {gh_stops}")
    print(f"    osm:             {osm_stops:,}")
    print(f"    routemaster:     {rm_stops}")
    print(f"  Patterns:          {len(patterns)} ({multi_variant} multi-variant GitHub routes)")
    print(f"    github:          {github_patterns}")
    print(f"    routemaster:     {rm_patterns}")
    print(f"    metadata-only:   {meta_patterns}")
    print(f"  Pattern stops:     {len(pattern_stops_list):,}")
    print(f"  Route stops:       {len(route_stops_list):,} (backward compat, primary only)")
    print(f"  Timetable entries: {len(timetable_entries):,}")
    print(f"\n  Output: {OUTPUT_PATH}\n")

    # Show multi-variant detail
    if multi_variant:
        print("  Multi-variant routes (GitHub):")
        for rno, variants in sorted(route_buses.items()):
            if len(variants) <= 1:
                continue
            longest_idx = max(range(len(variants)), key=lambda i: len(variants[i]['stops']))
            parts = []
            for i, v in enumerate(variants):
                marker = " *" if i == longest_idx else ""
                parts.append(f"{v['to']}({len(v['stops'])}){marker}")
            print(f"    {rno}: {', '.join(parts)}")
        print("    (* = primary)\n")


def _route_sort_key(route_id: str):
    """
    Sort routes so that purely numeric IDs come first (numerically),
    followed by alphanumeric IDs (lexicographically).
    """
    # Extract leading digits for numeric sort
    match = re.match(r'^(\d+)', route_id)
    if match:
        return (0, int(match.group(1)), route_id)
    return (1, 0, route_id)


if __name__ == '__main__':
    main()
