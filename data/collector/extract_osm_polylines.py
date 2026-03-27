#!/usr/bin/env python3
"""
Extract road-snapped polylines for bus route relations from OpenStreetMap.

For each route relation with a "ref" (route number) in osm_routes.json,
queries the Overpass API to get full geometry (ways + nodes), then
assembles an ordered polyline.

Output: osm_polylines.json
Format: {route_ref: {name, relation_id, polyline: [[lng, lat], ...], stops: [{name, lat, lng}]}}

Respects Overpass API rate limits with 2-second delays between requests.
Caches results - skips routes already in osm_polylines.json.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROUTES_FILE = os.path.join(SCRIPT_DIR, "osm_routes.json")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "osm_polylines.json")
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DELAY_SECONDS = 2
MAX_ROUTES = None  # Set to a number to limit processing, None for all


def load_routes():
    """Load OSM routes from cached file."""
    with open(ROUTES_FILE, "r") as f:
        routes = json.load(f)
    # Only routes with a ref field
    return [r for r in routes if r.get("ref")]


def load_cache():
    """Load existing cached polylines if available."""
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r") as f:
            return json.load(f)
    return {}


def save_cache(data):
    """Save polylines to output file."""
    with open(OUTPUT_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def query_overpass(relation_id):
    """Query Overpass API for a route relation with all its members resolved."""
    query = f"""[out:json][timeout:60];
relation({relation_id});
(._;>;);
out body;"""

    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(
        OVERPASS_URL,
        data=data,
        headers={"User-Agent": "Mansariya-BusTracker/1.0 (research)"},
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    Rate limited! Waiting 30 seconds...")
            time.sleep(30)
            # Retry once
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode("utf-8"))
        raise
    except urllib.error.URLError as e:
        print(f"    Network error: {e}")
        return None


def build_polyline_from_relation(overpass_data):
    """
    Build an ordered polyline from Overpass relation data.

    Strategy:
    1. Parse all nodes into a lookup dict {id: (lat, lon)}
    2. Parse the relation to get ordered way member IDs
    3. Parse each way to get its node sequence
    4. Chain ways together, flipping direction if needed to form a continuous line
    5. Also extract stops (nodes with public_transport=stop_position or highway=bus_stop)
    """
    elements = overpass_data.get("elements", [])

    # Build node lookup
    nodes = {}
    for el in elements:
        if el["type"] == "node":
            nodes[el["id"]] = (el["lat"], el["lon"])

    # Build way lookup (ordered list of node IDs)
    ways = {}
    for el in elements:
        if el["type"] == "way":
            ways[el["id"]] = el.get("nds", el.get("nodes", []))

    # Find the relation
    relation = None
    for el in elements:
        if el["type"] == "relation":
            relation = el
            break

    if not relation:
        return None, []

    # Get ordered way members from the relation
    way_members = []
    stop_members = []
    for member in relation.get("members", []):
        if member["type"] == "way" and member.get("role", "") in ("", "forward", "backward"):
            way_id = member["ref"]
            if way_id in ways:
                way_members.append({
                    "id": way_id,
                    "role": member.get("role", ""),
                    "nodes": ways[way_id],
                })
        elif member["type"] == "node" and member.get("role", "") in ("stop", "stop_entry_only", "stop_exit_only", "platform"):
            stop_members.append(member["ref"])

    if not way_members:
        return None, []

    # Chain ways into a continuous polyline
    polyline = chain_ways(way_members, nodes)

    # Extract stops
    stops = []
    seen_stop_ids = set()
    for node_id in stop_members:
        if node_id in nodes and node_id not in seen_stop_ids:
            seen_stop_ids.add(node_id)
            lat, lon = nodes[node_id]
            # Try to find name from node tags
            name = ""
            for el in elements:
                if el["type"] == "node" and el["id"] == node_id:
                    name = el.get("tags", {}).get("name", "")
                    break
            stops.append({"name": name, "lat": lat, "lng": lon})

    return polyline, stops


def chain_ways(way_members, nodes):
    """
    Chain ways into a continuous polyline by matching endpoints.
    Ways may need to be reversed to form a continuous line.
    """
    if not way_members:
        return []

    # Start with the first way
    first_way = way_members[0]
    first_node_ids = first_way["nodes"]

    # Build the initial polyline from the first way
    result_node_ids = list(first_node_ids)

    remaining = list(way_members[1:])

    # Iteratively attach ways to the chain
    max_iterations = len(remaining) * 2  # prevent infinite loop
    iteration = 0
    while remaining and iteration < max_iterations:
        iteration += 1
        found = False
        for i, way in enumerate(remaining):
            way_nodes = way["nodes"]
            if not way_nodes:
                remaining.pop(i)
                found = True
                break

            chain_start = result_node_ids[0]
            chain_end = result_node_ids[-1]
            way_start = way_nodes[0]
            way_end = way_nodes[-1]

            if chain_end == way_start:
                # Append way (same direction)
                result_node_ids.extend(way_nodes[1:])
                remaining.pop(i)
                found = True
                break
            elif chain_end == way_end:
                # Append way reversed
                result_node_ids.extend(reversed(way_nodes[:-1]))
                remaining.pop(i)
                found = True
                break
            elif chain_start == way_end:
                # Prepend way (same direction)
                result_node_ids = way_nodes[:-1] + result_node_ids
                remaining.pop(i)
                found = True
                break
            elif chain_start == way_start:
                # Prepend way reversed
                result_node_ids = list(reversed(way_nodes[1:])) + result_node_ids
                remaining.pop(i)
                found = True
                break

        if not found:
            # No connecting way found - just append the next one with a gap
            next_way = remaining.pop(0)
            result_node_ids.extend(next_way["nodes"])

    # Convert node IDs to coordinates [lng, lat]
    polyline = []
    for node_id in result_node_ids:
        if node_id in nodes:
            lat, lon = nodes[node_id]
            polyline.append([round(lon, 7), round(lat, 7)])

    return polyline


def make_cache_key(route):
    """
    Create a unique cache key for a route.
    Uses ref_osmid to handle duplicate refs (e.g., two routes with ref=103).
    """
    return f"{route['ref']}_{route['osm_id']}"


def main():
    routes = load_routes()
    cache = load_cache()

    print(f"Found {len(routes)} routes with ref numbers")
    print(f"Cached: {len(cache)} routes already processed")

    # Determine which routes need processing
    to_process = []
    for route in routes:
        key = make_cache_key(route)
        if key not in cache:
            to_process.append(route)

    if MAX_ROUTES:
        to_process = to_process[:MAX_ROUTES]

    print(f"To process: {len(to_process)} routes")
    if not to_process:
        print("All routes already cached. Nothing to do.")
        return

    success = 0
    failed = 0

    for i, route in enumerate(to_process):
        key = make_cache_key(route)
        ref = route["ref"]
        name = route.get("name", "")
        osm_id = route["osm_id"]

        print(f"\n[{i+1}/{len(to_process)}] Route {ref} (relation {osm_id}): {name}")

        # Query Overpass API
        print(f"  Querying Overpass API...")
        try:
            result = query_overpass(osm_id)
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
            time.sleep(DELAY_SECONDS)
            continue

        if result is None:
            print(f"  ERROR: No response from Overpass")
            failed += 1
            time.sleep(DELAY_SECONDS)
            continue

        # Build polyline
        polyline, stops = build_polyline_from_relation(result)

        if polyline and len(polyline) > 1:
            cache[key] = {
                "ref": ref,
                "name": name,
                "relation_id": osm_id,
                "polyline": polyline,
                "stops": stops,
                "point_count": len(polyline),
                "stop_count": len(stops),
            }
            print(f"  OK: {len(polyline)} points, {len(stops)} stops")
            success += 1
        else:
            print(f"  WARNING: Could not build polyline (empty or single point)")
            # Still cache it to avoid re-querying
            cache[key] = {
                "ref": ref,
                "name": name,
                "relation_id": osm_id,
                "polyline": polyline or [],
                "stops": stops,
                "point_count": len(polyline) if polyline else 0,
                "stop_count": len(stops),
            }
            failed += 1

        # Save after each route (incremental caching)
        save_cache(cache)

        # Be polite to Overpass API
        if i < len(to_process) - 1:
            print(f"  Waiting {DELAY_SECONDS}s...")
            time.sleep(DELAY_SECONDS)

    print(f"\n{'='*60}")
    print(f"Done! Success: {success}, Failed: {failed}")
    print(f"Total cached routes: {len(cache)}")
    print(f"Output: {OUTPUT_FILE}")

    # Print summary
    total_points = sum(r.get("point_count", 0) for r in cache.values())
    total_stops = sum(r.get("stop_count", 0) for r in cache.values())
    print(f"Total polyline points: {total_points}")
    print(f"Total stops: {total_stops}")


if __name__ == "__main__":
    main()
