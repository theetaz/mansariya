#!/usr/bin/env python3
"""
Match OSM bus stops to routes by proximity to route polylines/stops.

For routes with stop_coords or osm_polyline, find nearby OSM bus stops
and add them to enrich the stop coverage.
"""

import json
import math
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
OSM_STOPS_FILE = BASE_DIR / "osm_bus_stops.json"
ROUTES_FILE = BASE_DIR / "routes.json"
OUTPUT = BASE_DIR / "routes.json"


def haversine(lat1, lng1, lat2, lng2):
    """Distance in km between two points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def find_nearby_stops(route_points, osm_stops, max_dist_km=0.15):
    """Find OSM stops within max_dist_km of any point on the route."""
    nearby = []
    seen = set()

    for stop in osm_stops:
        if not stop["name"]:
            continue
        slat, slng = stop["lat"], stop["lng"]

        for plat, plng in route_points:
            if haversine(slat, slng, plat, plng) <= max_dist_km:
                if stop["osm_id"] not in seen:
                    seen.add(stop["osm_id"])
                    nearby.append({
                        "name": stop["name"],
                        "name_si": stop.get("name_si", ""),
                        "name_ta": stop.get("name_ta", ""),
                        "lat": slat,
                        "lng": slng,
                    })
                break

    return nearby


def main():
    print("=" * 60)
    print("Matching OSM stops to routes")
    print("=" * 60)

    with open(OSM_STOPS_FILE) as f:
        osm_stops = json.load(f)
    print(f"OSM stops: {len(osm_stops)}")

    with open(ROUTES_FILE) as f:
        routes = json.load(f)
    print(f"Routes: {len(routes)}")

    enriched = 0
    total_new_stops = 0

    for route in routes:
        # Get route points (from stop_coords or osm_polyline)
        route_points = []

        if route.get("stop_coords"):
            for sc in route["stop_coords"]:
                route_points.append((sc["lat"], sc["lng"]))

        if route.get("osm_polyline"):
            # Sample every 10th point to avoid O(n^2) explosion
            for i, coord in enumerate(route["osm_polyline"]):
                if i % 10 == 0:
                    route_points.append((coord[1], coord[0]))  # [lng,lat] -> (lat,lng)

        if not route_points:
            continue

        # Find nearby OSM stops
        nearby = find_nearby_stops(route_points, osm_stops, max_dist_km=0.15)

        if nearby:
            # Merge with existing stops, avoiding duplicates
            existing_names = set(s.lower() for s in route.get("stops", []))
            new_stops = []
            for ns in nearby:
                if ns["name"].lower() not in existing_names:
                    new_stops.append(ns)
                    existing_names.add(ns["name"].lower())

            if new_stops:
                # Add new stop names
                route.setdefault("stops", [])
                for ns in new_stops:
                    route["stops"].append(ns["name"])

                # Add/extend matched_osm_stops for trilingual data
                route.setdefault("matched_osm_stops", [])
                route["matched_osm_stops"].extend(new_stops)

                enriched += 1
                total_new_stops += len(new_stops)

    print(f"\nEnriched {enriched} routes with {total_new_stops} new stops from OSM proximity matching")

    # Stats
    with_stops = sum(1 for r in routes if r.get("stops"))
    print(f"Routes with stops: {with_stops}")

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)
    print(f"Written to {OUTPUT}")


if __name__ == "__main__":
    main()
