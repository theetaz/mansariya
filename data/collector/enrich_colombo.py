#!/usr/bin/env python3
"""
Enrich Colombo-area routes with stops from OSM bus stops proximity matching.

For routes that have waypoints or polylines but no stops, find nearby OSM
bus stops along the route path and assign them.
"""

import json
import math
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ROUTES_FILE = BASE_DIR / "routes.json"
OSM_STOPS_FILE = BASE_DIR / "osm_bus_stops.json"
ROUTEMASTER_FILE = BASE_DIR / "collector" / "routemaster_routes.json"

# Colombo bounding box (approximate)
COLOMBO_BOUNDS = {
    "min_lat": 6.75, "max_lat": 7.15,
    "min_lng": 79.75, "max_lng": 80.05,
}


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def is_in_colombo(lat, lng):
    return (COLOMBO_BOUNDS["min_lat"] <= lat <= COLOMBO_BOUNDS["max_lat"] and
            COLOMBO_BOUNDS["min_lng"] <= lng <= COLOMBO_BOUNDS["max_lng"])


def get_route_points(route):
    """Extract lat/lng points from any available geo data."""
    points = []

    if route.get("stop_coords"):
        for sc in route["stop_coords"]:
            points.append((sc["lat"], sc["lng"]))

    if route.get("osm_polyline"):
        for i, coord in enumerate(route["osm_polyline"]):
            if i % 5 == 0:  # sample every 5th point
                points.append((coord[1], coord[0]))

    if route.get("waypoints"):
        for wp in route["waypoints"]:
            if isinstance(wp, dict):
                points.append((wp["lat"], wp["lng"]))
            elif isinstance(wp, (list, tuple)) and len(wp) >= 2:
                points.append((wp[0], wp[1]))

    return points


def find_stops_along_route(route_points, osm_stops, max_dist_km=0.2):
    """Find OSM stops near route points, ordered by proximity to route start."""
    if not route_points:
        return []

    nearby = []
    seen = set()

    for stop in osm_stops:
        if not stop.get("name"):
            continue
        slat, slng = stop["lat"], stop["lng"]

        min_dist = float('inf')
        closest_idx = 0

        for idx, (plat, plng) in enumerate(route_points):
            d = haversine(slat, slng, plat, plng)
            if d < min_dist:
                min_dist = d
                closest_idx = idx

        if min_dist <= max_dist_km and stop["osm_id"] not in seen:
            seen.add(stop["osm_id"])
            nearby.append({
                "name": stop["name"],
                "name_si": stop.get("name_si", ""),
                "name_ta": stop.get("name_ta", ""),
                "lat": slat,
                "lng": slng,
                "route_idx": closest_idx,
                "distance": min_dist,
            })

    # Sort by position along route
    nearby.sort(key=lambda s: s["route_idx"])

    # Remove route_idx and distance from output
    for s in nearby:
        del s["route_idx"]
        del s["distance"]

    return nearby


def main():
    print("=" * 60)
    print("Enriching Colombo Area Routes")
    print("=" * 60)

    with open(ROUTES_FILE) as f:
        routes = json.load(f)

    with open(OSM_STOPS_FILE) as f:
        all_osm_stops = json.load(f)

    # Filter OSM stops to Colombo area for faster matching
    colombo_stops = [s for s in all_osm_stops if is_in_colombo(s["lat"], s["lng"])]
    print(f"OSM stops in Colombo area: {len(colombo_stops)}")

    enriched = 0
    stops_added = 0

    for route in routes:
        # Skip if already has stops
        if route.get("stops") and len(route["stops"]) > 3:
            continue

        # Get any geo points for this route
        points = get_route_points(route)
        if not points:
            continue

        # Check if any points are in Colombo
        colombo_points = [(lat, lng) for lat, lng in points if is_in_colombo(lat, lng)]
        if not colombo_points:
            continue

        # Find nearby stops
        nearby = find_stops_along_route(points, colombo_stops, max_dist_km=0.25)

        if not nearby:
            continue

        # Update route
        existing_names = set(s.lower() for s in route.get("stops", []))
        new_stop_names = []
        new_stop_coords = []

        for s in nearby:
            if s["name"].lower() not in existing_names:
                new_stop_names.append(s["name"])
                new_stop_coords.append({"name": s["name"], "lat": s["lat"], "lng": s["lng"]})
                existing_names.add(s["name"].lower())

        if new_stop_names:
            route.setdefault("stops", []).extend(new_stop_names)
            route.setdefault("matched_osm_stops", []).extend(
                [{"name": s["name"], "name_si": s["name_si"], "name_ta": s["name_ta"],
                  "lat": s["lat"], "lng": s["lng"]} for s in nearby
                 if s["name"].lower() in {n.lower() for n in new_stop_names}]
            )
            enriched += 1
            stops_added += len(new_stop_names)

    # Stats
    colombo_routes = [r for r in routes
                      if any(is_in_colombo(p[0], p[1]) for p in get_route_points(r))
                      or any(k in (r.get('name_en', '') or '').lower()
                             for k in ['pettah', 'colombo', 'fort', 'kottawa', 'nugegoda'])]

    with_stops = sum(1 for r in colombo_routes if r.get('stops'))

    print(f"\nEnriched {enriched} routes with {stops_added} new stops")
    print(f"Colombo routes with stops: {with_stops}")

    with open(ROUTES_FILE, 'w', encoding='utf-8') as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)
    print(f"Written to {ROUTES_FILE}")


if __name__ == "__main__":
    main()
