#!/usr/bin/env python3
"""
Final merger: combine ALL collected data sources into routes.json

Sources merged:
  1. Existing routes_comprehensive.json (NTC fares + existing manual + GitHub + OSM stops)
  2. NTC Permits PDF (English origin/destination for 203 routes)
  3. OSM Polylines (road geometry for 7 routes)
  4. Routemaster.lk (if available)
  5. fix_and_enrich corrections (known route names, Sinhala/Tamil)
"""

import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
COLLECTOR = BASE_DIR / "collector"

# Input files
COMPREHENSIVE = BASE_DIR / "routes_comprehensive.json"
PERMITS_FILE = COLLECTOR / "ntc_permits_parsed.json"
OSM_POLYLINES_FILE = COLLECTOR / "osm_polylines.json"
ROUTEMASTER_FILE = COLLECTOR / "routemaster_routes.json"
OUTPUT = BASE_DIR / "routes.json"

# Import known routes from fix_and_enrich
import sys
sys.path.insert(0, str(COLLECTOR))
from fix_and_enrich import KNOWN_ROUTES, load_github_stops


def normalize_route_no(route_no):
    """Normalize route number format from permits (e.g., '001' -> '1', '002-001' -> '2')."""
    # Remove leading zeros
    route_no = re.sub(r'^0+', '', route_no) or '0'
    # Handle permit format like "002-001" -> just use first part
    if re.match(r'^\d+-\d{3}$', route_no):
        route_no = route_no.split('-')[0]
        route_no = re.sub(r'^0+', '', route_no) or '0'
    return route_no


def main():
    print("=" * 60)
    print("Final Data Merge — All Sources")
    print("=" * 60)

    # Load comprehensive (base)
    with open(COMPREHENSIVE) as f:
        routes_list = json.load(f)
    merged = {r["id"]: r for r in routes_list}
    print(f"\nBase: {len(merged)} routes from comprehensive.json")

    # ── Load NTC Permits ──
    permits_enriched = 0
    permits_added = 0
    if PERMITS_FILE.exists():
        with open(PERMITS_FILE) as f:
            permits = json.load(f)
        print(f"Permits: {len(permits)} unique routes")

        for p in permits:
            raw_no = p["route_no"]
            rid = normalize_route_no(raw_no)
            origin = p["origin"].title()
            dest = p["destination"].title()
            name_en = f"{origin} - {dest}"

            if rid in merged:
                # Enrich existing route with English name if missing
                if not merged[rid].get("name_en") or merged[rid]["name_en"].startswith("Colombo - (via"):
                    merged[rid]["name_en"] = name_en
                    permits_enriched += 1
            else:
                merged[rid] = {
                    "id": rid,
                    "name_en": name_en,
                    "name_si": "",
                    "name_ta": "",
                    "operator": "",
                    "service_type": p.get("service_type", "Normal"),
                    "fare_lkr": 0,
                    "frequency_minutes": 0,
                    "operating_hours": "",
                    "stops": [],
                    "source": "ntc_permits"
                }
                permits_added += 1

        print(f"  Enriched {permits_enriched} routes with English names")
        print(f"  Added {permits_added} new routes")

    # ── Load OSM Polylines ──
    osm_poly_count = 0
    if OSM_POLYLINES_FILE.exists():
        with open(OSM_POLYLINES_FILE) as f:
            polylines = json.load(f)
        print(f"OSM Polylines: {len(polylines)} routes")

        for key, data in polylines.items():
            # Key format: "ref_osmid" — extract ref
            ref = key.split("_")[0] if "_" in key else key
            polyline = data.get("polyline", [])

            if ref in merged and polyline:
                if not merged[ref].get("osm_polyline"):
                    merged[ref]["osm_polyline"] = polyline
                    osm_poly_count += 1

                # Also add OSM stops if route has none
                osm_stops = data.get("stops", [])
                if osm_stops and not merged[ref].get("stops"):
                    merged[ref]["stops"] = [s.get("name", "") for s in osm_stops if s.get("name")]

        print(f"  Added polylines to {osm_poly_count} routes")

    # ── Load Routemaster (if available) ──
    if ROUTEMASTER_FILE.exists():
        with open(ROUTEMASTER_FILE) as f:
            rm_routes = json.load(f)
        print(f"Routemaster: {len(rm_routes)} routes")

        rm_added = 0
        for r in rm_routes:
            rid = str(r.get("route_no", ""))
            if not rid:
                continue
            waypoints = r.get("waypoints", [])
            if rid in merged:
                if waypoints and not merged[rid].get("waypoints"):
                    merged[rid]["waypoints"] = waypoints
            else:
                merged[rid] = {
                    "id": rid,
                    "name_en": r.get("name", ""),
                    "name_si": "",
                    "name_ta": "",
                    "operator": "",
                    "service_type": "Normal",
                    "fare_lkr": 0,
                    "frequency_minutes": 0,
                    "operating_hours": "",
                    "stops": r.get("stops", []),
                    "waypoints": waypoints,
                    "source": "routemaster"
                }
                rm_added += 1
        print(f"  Added {rm_added} new routes")

    # ── Apply KNOWN_ROUTES corrections ──
    github_stops = load_github_stops()
    fixed = 0
    for rid, data in KNOWN_ROUTES.items():
        if rid in merged:
            name_en, name_si, name_ta, operator, svc = data
            merged[rid]["name_en"] = name_en
            merged[rid]["name_si"] = name_si
            merged[rid]["name_ta"] = name_ta
            merged[rid]["operator"] = operator
            merged[rid]["service_type"] = svc
            fixed += 1

        # Apply GitHub GPS stops
        if rid in github_stops:
            gh = github_stops[rid]
            merged[rid]["stops"] = gh["stops"]
            merged[rid]["stop_coords"] = gh["stop_coords"]
            if KNOWN_ROUTES.get(rid, ("", "", "", "", ""))[3] == "Private":
                merged[rid]["fare_lkr"] = 0

    # Name sub-routes from parent
    named = 0
    for rid, route in merged.items():
        if not route.get("name_en"):
            base = re.match(r'^(\d+)', rid)
            if base and base.group(1) in KNOWN_ROUTES:
                parent_name = KNOWN_ROUTES[base.group(1)][0]
                origin = parent_name.split(" - ")[0]
                route["name_en"] = f"{origin} - (via {rid})"
                named += 1

    print(f"\nApplied {fixed} known route corrections, named {named} sub-routes")

    # ── Sort ──
    def sort_key(route_id):
        nums = re.findall(r'\d+', route_id)
        return (int(nums[0]) if nums else 9999, route_id)

    sorted_routes = sorted(merged.values(), key=lambda r: sort_key(r["id"]))

    # ── Clean up ──
    for r in sorted_routes:
        r.pop("source", None)
        r.pop("origin_si", None)
        r.pop("dest_si", None)
        if r.get("stop_coords") == []:
            r.pop("stop_coords", None)
        if r.get("osm_polyline") == []:
            r.pop("osm_polyline", None)
        if r.get("waypoints") == []:
            r.pop("waypoints", None)
        r.setdefault("name_en", "")
        r.setdefault("name_si", "")
        r.setdefault("name_ta", "")
        r.setdefault("operator", "")
        r.setdefault("service_type", "Normal")
        r.setdefault("fare_lkr", 0)
        r.setdefault("frequency_minutes", 0)
        r.setdefault("operating_hours", "")
        r.setdefault("stops", [])

    # ── Final Stats ──
    total = len(sorted_routes)
    with_name = sum(1 for r in sorted_routes if r.get("name_en") and not r["name_en"].startswith("Colombo - (via"))
    with_stops = sum(1 for r in sorted_routes if r.get("stops"))
    with_coords = sum(1 for r in sorted_routes if r.get("stop_coords"))
    with_fares = sum(1 for r in sorted_routes if r.get("fare_lkr"))
    with_polyline = sum(1 for r in sorted_routes if r.get("osm_polyline"))

    print(f"\n{'=' * 60}")
    print(f"FINAL DATASET")
    print(f"{'=' * 60}")
    print(f"  Total routes:              {total}")
    print(f"  With proper English name:  {with_name}")
    print(f"  With stop names:           {with_stops}")
    print(f"  With GPS stop coords:      {with_coords}")
    print(f"  With fares:                {with_fares}")
    print(f"  With OSM polylines:        {with_polyline}")

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(sorted_routes, f, ensure_ascii=False, indent=2)
    print(f"\nWritten to {OUTPUT}")


if __name__ == "__main__":
    main()
