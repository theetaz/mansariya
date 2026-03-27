#!/usr/bin/env python3
"""
Mansariya Route Data Collector
Combines multiple sources to build a comprehensive Sri Lankan bus route database.

Sources:
  1. NTC fare PDF (ntc.gov.lk) — route numbers + fares
  2. OSM Overpass API — bus stop GPS coordinates + route relations
  3. GitHub janithl/Bus-Route-Finder — Colombo routes with GPS stops
  4. Existing routes.json — preserve manual data

Usage:
  python3 data/collector/collect.py
"""

import json
import os
import re
import requests
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
COLLECTOR_DIR = BASE_DIR / "collector"
OUTPUT_FILE = BASE_DIR / "routes_comprehensive.json"
EXISTING_FILE = BASE_DIR / "routes.json"
OSM_STOPS_FILE = COLLECTOR_DIR / "osm_stops.json"
OSM_ROUTES_FILE = COLLECTOR_DIR / "osm_routes.json"
GITHUB_DATA_FILE = COLLECTOR_DIR / "github_colombo.json"

import warnings
warnings.filterwarnings("ignore")


# ─── Source 1: NTC Fare PDF ───────────────────────────────────────────────────

def fetch_ntc_routes():
    """Download and parse the NTC inter-provincial fare PDF."""
    print("\n[1/4] Fetching NTC fare data...")

    pdf_path = COLLECTOR_DIR / "ntc_fares.pdf"
    if not pdf_path.exists():
        print("  Downloading NTC fare PDF...")
        try:
            resp = requests.get(
                "https://ntc.gov.lk/bus_fare/2024/july/Inter%20Provincial%20Route%20fare%20Ad%20-%202024-07-02.pdf",
                timeout=30, verify=False
            )
            resp.raise_for_status()
            pdf_path.write_bytes(resp.content)
            print(f"  Downloaded {len(resp.content)} bytes")
        except Exception as e:
            print(f"  Failed to download: {e}")
            return []

    try:
        import pdfplumber
    except ImportError:
        print("  pdfplumber not installed")
        return []

    routes = {}
    with pdfplumber.open(pdf_path) as pdf:
        print(f"  Parsing {len(pdf.pages)} pages...")
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            for line in text.split('\n'):
                # Match: route_id text fare.00
                for m in re.finditer(
                    r'(\d+(?:[/-]\d+)*(?:/\d+)*)\s+(.+?)\s+(\d+\.\d{2})\s',
                    line
                ):
                    route_id = m.group(1)
                    fare = int(float(m.group(3)))
                    if route_id not in routes:
                        routes[route_id] = {"id": route_id, "fare_lkr": fare}

    result = list(routes.values())
    print(f"  Parsed {len(result)} unique routes with fares")
    return result


# ─── Source 2: OpenStreetMap ──────────────────────────────────────────────────

def fetch_osm_bus_stops():
    """Fetch all bus stops in Sri Lanka from OSM."""
    print("\n[2/4] Fetching OSM bus stops...")

    if OSM_STOPS_FILE.exists():
        with open(OSM_STOPS_FILE) as f:
            stops = json.load(f)
        print(f"  Loaded {len(stops)} cached stops")
        return stops

    query = """
    [out:json][timeout:120];
    area["ISO3166-1"="LK"]->.sri_lanka;
    (
      node["highway"="bus_stop"](area.sri_lanka);
      node["public_transport"="platform"]["bus"="yes"](area.sri_lanka);
      node["public_transport"="stop_position"]["bus"="yes"](area.sri_lanka);
    );
    out body;
    """

    try:
        resp = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query}, timeout=120
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  Failed: {e}")
        return []

    stops = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        stops.append({
            "osm_id": el["id"],
            "name": tags.get("name:en", tags.get("name", "")),
            "name_si": tags.get("name:si", ""),
            "name_ta": tags.get("name:ta", ""),
            "lat": el["lat"],
            "lng": el["lon"],
        })

    with open(OSM_STOPS_FILE, 'w') as f:
        json.dump(stops, f, ensure_ascii=False, indent=2)
    print(f"  Fetched {len(stops)} bus stops")
    return stops


def fetch_osm_bus_routes():
    """Fetch all bus route relations in Sri Lanka from OSM."""
    print("  Fetching OSM bus routes...")

    if OSM_ROUTES_FILE.exists():
        with open(OSM_ROUTES_FILE) as f:
            routes = json.load(f)
        print(f"  Loaded {len(routes)} cached routes")
        return routes

    query = """
    [out:json][timeout:120];
    area["ISO3166-1"="LK"]->.sri_lanka;
    relation["type"="route"]["route"="bus"](area.sri_lanka);
    out body;
    """

    try:
        resp = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query}, timeout=120
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  Failed: {e}")
        return []

    routes = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        stop_ids = [
            m["ref"] for m in el.get("members", [])
            if m.get("role") in ("stop", "platform", "stop_entry_only", "stop_exit_only")
        ]
        routes.append({
            "osm_id": el["id"],
            "ref": tags.get("ref", ""),
            "name": tags.get("name", ""),
            "from": tags.get("from", ""),
            "to": tags.get("to", ""),
            "operator": tags.get("operator", ""),
            "stop_ids": stop_ids,
        })

    with open(OSM_ROUTES_FILE, 'w') as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)
    print(f"  Fetched {len(routes)} bus routes")
    return routes


# ─── Source 3: GitHub janithl/Bus-Route-Finder ────────────────────────────────

def fetch_github_data():
    """Parse Colombo bus routes + stops from GitHub SQL dump."""
    print("\n[3/4] Fetching GitHub Colombo bus data...")

    if GITHUB_DATA_FILE.exists():
        with open(GITHUB_DATA_FILE) as f:
            data = json.load(f)
        print(f"  Loaded cached: {len(data['routes'])} routes, {len(data['places'])} places")
        return data

    try:
        resp = requests.get(
            "https://raw.githubusercontent.com/janithl/Bus-Route-Finder/master/bus.sql",
            timeout=15
        )
        resp.raise_for_status()
        sql = resp.text
    except Exception as e:
        print(f"  Failed: {e}")
        return {"routes": [], "places": [], "stops": []}

    # Parse bus table: (busid, routeno, from, to)
    routes = []
    for m in re.finditer(r"\((\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)", sql):
        bus_id = int(m.group(1))
        if bus_id <= 100:  # skip reverse direction duplicates (101+)
            routes.append({
                "bus_id": bus_id,
                "route_no": m.group(2),
                "from": m.group(3),
                "to": m.group(4),
            })

    # Parse place table: (pid, name, area, loc, desc)
    places = {}
    for m in re.finditer(
        r"\((\d+),\s*'([^']*)',\s*'([^']*)',\s*'([\d.,|]*)'",
        sql
    ):
        pid = int(m.group(1))
        name = m.group(2).replace("''", "'")
        loc = m.group(4).split("|")[0]  # take first coordinate if multiple
        parts = loc.split(",")
        if len(parts) == 2:
            try:
                places[pid] = {
                    "id": pid,
                    "name": name,
                    "area": m.group(3),
                    "lat": float(parts[0]),
                    "lng": float(parts[1]),
                }
            except ValueError:
                pass

    # Parse stop table: (bid, pid, stopNo)
    stop_mappings = []
    for m in re.finditer(r"\((\d+),\s*(\d+),\s*(\d+)\)", sql):
        # Only after the stop table section
        bid, pid, stop_no = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if bid <= 100:
            stop_mappings.append({"bus_id": bid, "place_id": pid, "stop_order": stop_no})

    data = {
        "routes": routes,
        "places": list(places.values()),
        "stops": stop_mappings,
        "places_map": {p["id"]: p for p in places.values()},
    }

    # Cache (without places_map for serialization)
    cache = {"routes": routes, "places": list(places.values()), "stops": stop_mappings}
    with open(GITHUB_DATA_FILE, 'w') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    print(f"  Found {len(routes)} routes, {len(places)} places, {len(stop_mappings)} stop mappings")
    return data


# ─── Merger ───────────────────────────────────────────────────────────────────

def merge_all(existing_routes, ntc_routes, osm_stops, osm_routes, github_data):
    """Merge all sources into a unified dataset."""
    print("\n" + "=" * 60)
    print("MERGING ALL SOURCES")
    print("=" * 60)

    merged = {}

    # ── Start with existing (highest trust) ──
    for r in existing_routes:
        merged[r["id"]] = dict(r)
        merged[r["id"]].setdefault("source", "manual")

    # ── Build GitHub route → stops mapping ──
    places_map = {}
    if "places_map" in github_data:
        places_map = github_data["places_map"]
    else:
        for p in github_data.get("places", []):
            places_map[p["id"]] = p

    gh_route_stops = {}  # bus_id -> ordered stop names + coords
    for sm in github_data.get("stops", []):
        bid = sm["bus_id"]
        pid = sm["place_id"]
        order = sm["stop_order"]
        if pid in places_map:
            gh_route_stops.setdefault(bid, []).append((order, places_map[pid]))

    # Sort stops by order
    for bid in gh_route_stops:
        gh_route_stops[bid].sort(key=lambda x: x[0])

    # Map bus_id -> route info
    gh_routes_by_number = {}
    for r in github_data.get("routes", []):
        route_no = r["route_no"]
        if route_no not in gh_routes_by_number:
            gh_routes_by_number[route_no] = r
            gh_routes_by_number[route_no]["ordered_stops"] = gh_route_stops.get(r["bus_id"], [])

    # ── Add/enrich from GitHub ──
    gh_added = 0
    gh_enriched = 0
    for route_no, gr in gh_routes_by_number.items():
        name_en = f"{gr['from']} - {gr['to']}"
        stops = [s[1]["name"] for s in gr.get("ordered_stops", [])]
        stop_coords = [
            {"name": s[1]["name"], "lat": s[1]["lat"], "lng": s[1]["lng"]}
            for s in gr.get("ordered_stops", [])
        ]

        if route_no in merged:
            # Enrich existing: add stop coords if missing, fix name if wrong
            existing = merged[route_no]
            if not existing.get("stop_coords") and stop_coords:
                existing["stop_coords"] = stop_coords
                gh_enriched += 1
            # If existing stops are wrong (different origin/dest), flag it
            if stops and existing.get("name_en"):
                existing_origin = existing["name_en"].split(" - ")[0].strip().lower()
                gh_origin = gr["from"].strip().lower()
                if existing_origin != gh_origin and existing_origin not in gh_origin:
                    existing["_github_name"] = name_en
                    existing["_github_stops"] = stops
        else:
            merged[route_no] = {
                "id": route_no,
                "name_en": name_en,
                "name_si": "",
                "name_ta": "",
                "operator": "",
                "service_type": "Normal",
                "fare_lkr": 0,
                "frequency_minutes": 0,
                "operating_hours": "",
                "stops": stops,
                "stop_coords": stop_coords,
                "source": "github"
            }
            gh_added += 1

    print(f"  GitHub: added {gh_added} new routes, enriched {gh_enriched}")

    # ── Build OSM stop lookup ──
    osm_stop_map = {s["osm_id"]: s for s in osm_stops}
    osm_route_map = {}
    for r in osm_routes:
        if r["ref"]:
            osm_route_map.setdefault(r["ref"], []).append(r)

    # ── Enrich/add from OSM ──
    osm_added = 0
    osm_enriched = 0
    for r in osm_routes:
        rid = r["ref"]
        if not rid:
            continue

        osm_stops_for_route = []
        for sid in r["stop_ids"]:
            if sid in osm_stop_map:
                s = osm_stop_map[sid]
                if s["name"]:
                    osm_stops_for_route.append({
                        "name": s["name"],
                        "lat": s["lat"],
                        "lng": s["lng"]
                    })

        name_en = r["name"]
        if not name_en and r["from"] and r["to"]:
            name_en = f"{r['from']} - {r['to']}"

        if rid in merged:
            existing = merged[rid]
            if not existing.get("stop_coords") and osm_stops_for_route:
                existing["stop_coords"] = osm_stops_for_route
                osm_enriched += 1
            if not existing.get("operator") and r["operator"]:
                existing["operator"] = r["operator"]
        else:
            stops = [s["name"] for s in osm_stops_for_route]
            merged[rid] = {
                "id": rid,
                "name_en": name_en,
                "name_si": "",
                "name_ta": "",
                "operator": r.get("operator", ""),
                "service_type": "Normal",
                "fare_lkr": 0,
                "frequency_minutes": 0,
                "operating_hours": "",
                "stops": stops,
                "stop_coords": osm_stops_for_route if osm_stops_for_route else [],
                "source": "osm"
            }
            osm_added += 1

    print(f"  OSM: added {osm_added} new routes, enriched {osm_enriched}")

    # ── Add NTC fare-only routes ──
    ntc_added = 0
    for nr in ntc_routes:
        rid = nr["id"]
        if rid in merged:
            if nr.get("fare_lkr") and not merged[rid].get("fare_lkr"):
                merged[rid]["fare_lkr"] = nr["fare_lkr"]
        else:
            merged[rid] = {
                "id": rid,
                "name_en": "",
                "name_si": "",
                "name_ta": "",
                "operator": "",
                "service_type": "Normal",
                "fare_lkr": nr.get("fare_lkr", 0),
                "frequency_minutes": 0,
                "operating_hours": "",
                "stops": [],
                "source": "ntc_pdf"
            }
            ntc_added += 1

    print(f"  NTC: added {ntc_added} fare-only routes")

    # ── Sort ──
    def sort_key(route_id):
        nums = re.findall(r'\d+', route_id)
        return (int(nums[0]) if nums else 9999, route_id)

    sorted_routes = sorted(merged.values(), key=lambda r: sort_key(r["id"]))

    # ── Clean up internal fields ──
    for r in sorted_routes:
        r.pop("_github_name", None)
        r.pop("_github_stops", None)

    # ── Stats ──
    total = len(sorted_routes)
    with_stops = sum(1 for r in sorted_routes if r.get("stops"))
    with_coords = sum(1 for r in sorted_routes if r.get("stop_coords"))
    with_fares = sum(1 for r in sorted_routes if r.get("fare_lkr"))
    with_names = sum(1 for r in sorted_routes if r.get("name_en"))

    print(f"\n{'=' * 60}")
    print(f"FINAL DATASET")
    print(f"{'=' * 60}")
    print(f"  Total routes:          {total}")
    print(f"  With English name:     {with_names}")
    print(f"  With stop names:       {with_stops}")
    print(f"  With GPS stop coords:  {with_coords}")
    print(f"  With fares:            {with_fares}")
    print(f"  OSM bus stops total:   {len(osm_stops)}")

    return sorted_routes


def main():
    print("=" * 60)
    print("Mansariya Route Data Collector")
    print("=" * 60)

    # Load existing
    existing = []
    if EXISTING_FILE.exists():
        with open(EXISTING_FILE) as f:
            existing = json.load(f)
        print(f"\nLoaded {len(existing)} existing routes")

    # Collect
    ntc = fetch_ntc_routes()
    osm_stops = fetch_osm_bus_stops()
    osm_routes = fetch_osm_bus_routes()
    github = fetch_github_data()

    # Merge
    merged = merge_all(existing, ntc, osm_stops, osm_routes, github)

    # Write
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"\nWritten to {OUTPUT_FILE}")

    # Save OSM stops separately
    osm_out = BASE_DIR / "osm_bus_stops.json"
    with open(osm_out, 'w', encoding='utf-8') as f:
        json.dump(osm_stops, f, ensure_ascii=False, indent=2)
    print(f"OSM stops saved to {osm_out}")


if __name__ == "__main__":
    main()
