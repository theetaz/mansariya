#!/usr/bin/env python3
"""
GTFS Export Tool for Mansariya
Converts Mansariya route/stop/timetable data into a valid GTFS feed.

Reads:
  - data/routes.json       (685 routes with names, stops, coordinates, fares)
  - data/timetables.json   (50 routes with departure times)
  - data/osm_bus_stops.json (4,272 stops with GPS)

Outputs:
  - data/gtfs/agency.txt
  - data/gtfs/routes.txt
  - data/gtfs/stops.txt
  - data/gtfs/trips.txt
  - data/gtfs/stop_times.txt
  - data/gtfs/calendar.txt
  - data/gtfs/shapes.txt
  - data/gtfs/gtfs.zip

Linear: THE-65
"""

import csv
import json
import math
import os
import re
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent
ROUTES_FILE = DATA_DIR / "routes.json"
TIMETABLES_FILE = DATA_DIR / "timetables.json"
OSM_STOPS_FILE = DATA_DIR / "osm_bus_stops.json"
GTFS_DIR = DATA_DIR / "gtfs"


def load_data():
    """Load all source data files."""
    with open(ROUTES_FILE, "r", encoding="utf-8") as f:
        routes = json.load(f)

    with open(TIMETABLES_FILE, "r", encoding="utf-8") as f:
        timetables = json.load(f)

    with open(OSM_STOPS_FILE, "r", encoding="utf-8") as f:
        osm_stops = json.load(f)

    return routes, timetables, osm_stops


def haversine_km(lat1, lon1, lat2, lon2):
    """Distance between two GPS points in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_route_stops(route):
    """
    Extract geo-located stops from a route.
    Returns list of dicts with 'name', 'lat', 'lng' keys.
    Priority: matched_osm_stops > stop_coords > waypoints.
    """
    if route.get("matched_osm_stops") and len(route["matched_osm_stops"]) >= 2:
        return [
            {"name": s["name"], "lat": s["lat"], "lng": s["lng"]}
            for s in route["matched_osm_stops"]
            if s.get("lat") and s.get("lng")
        ]

    if route.get("stop_coords") and len(route["stop_coords"]) >= 2:
        return [
            {"name": s["name"], "lat": s["lat"], "lng": s["lng"]}
            for s in route["stop_coords"]
            if s.get("lat") and s.get("lng")
        ]

    if route.get("waypoints") and len(route["waypoints"]) >= 2:
        return [
            {"name": w["name"], "lat": w["lat"], "lng": w["lng"]}
            for w in route["waypoints"]
            if w.get("lat") and w.get("lng") and w.get("name")
        ]

    return []


def get_route_name(route):
    """Get the best available route name."""
    return route.get("name_en") or route.get("name_si") or route.get("name_ta") or ""


def make_stop_id(name, lat, lng):
    """
    Create a deterministic stop_id from name and coordinates.
    Stops at the same location (within ~10m) with the same name share an ID.
    """
    # Round coords to ~11m precision for deduplication
    rlat = round(lat, 4)
    rlng = round(lng, 4)
    # Sanitize name for ID
    safe_name = re.sub(r"[^a-zA-Z0-9]", "_", name.strip().lower())
    safe_name = re.sub(r"_+", "_", safe_name).strip("_")
    if not safe_name:
        safe_name = "stop"
    return f"{safe_name}_{rlat}_{rlng}"


def parse_time(time_str):
    """
    Parse a time string like '3:00', '14:30', '23:45' into (hours, minutes).
    Returns (h, m) tuple.
    """
    time_str = time_str.strip()
    parts = time_str.split(":")
    h = int(parts[0])
    m = int(parts[1]) if len(parts) > 1 else 0
    return h, m


def format_gtfs_time(hours, minutes):
    """Format time as HH:MM:SS for GTFS (supports hours >= 24)."""
    return f"{hours:02d}:{minutes:02d}:00"


def compute_cumulative_distances(stops):
    """Compute cumulative distance from first stop to each stop in km."""
    distances = [0.0]
    for i in range(1, len(stops)):
        d = haversine_km(
            stops[i - 1]["lat"],
            stops[i - 1]["lng"],
            stops[i]["lat"],
            stops[i]["lng"],
        )
        distances.append(distances[-1] + d)
    return distances


def write_csv(filepath, fieldnames, rows):
    """Write a list of dicts to a CSV file."""
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_gtfs():
    """Main GTFS build pipeline."""
    routes_data, timetables_data, osm_stops_data = load_data()

    # Create output directory
    GTFS_DIR.mkdir(parents=True, exist_ok=True)

    # ── 1. Filter eligible routes (name + >= 2 geo stops) ──
    eligible_routes = []
    for route in routes_data:
        name = get_route_name(route)
        if not name:
            continue
        stops = get_route_stops(route)
        if len(stops) >= 2:
            eligible_routes.append(route)

    # Build route lookup
    route_by_id = {r["id"]: r for r in routes_data}

    # ── 2. agency.txt ──
    agency_rows = [
        {
            "agency_id": "mansariya",
            "agency_name": "Mansariya",
            "agency_url": "https://mansariya.lk",
            "agency_timezone": "Asia/Colombo",
            "agency_lang": "en",
        }
    ]
    write_csv(
        GTFS_DIR / "agency.txt",
        ["agency_id", "agency_name", "agency_url", "agency_timezone", "agency_lang"],
        agency_rows,
    )

    # ── 3. routes.txt ──
    routes_rows = []
    for route in eligible_routes:
        route_id = route["id"]
        name = get_route_name(route)
        # Use route ID as short name (the bus number passengers see)
        short_name = route_id
        routes_rows.append(
            {
                "route_id": route_id,
                "agency_id": "mansariya",
                "route_short_name": short_name,
                "route_long_name": name,
                "route_type": 3,  # Bus
            }
        )
    write_csv(
        GTFS_DIR / "routes.txt",
        [
            "route_id",
            "agency_id",
            "route_short_name",
            "route_long_name",
            "route_type",
        ],
        routes_rows,
    )

    # ── 4. Collect all stops (deduplicated) ──
    all_stops = {}  # stop_id -> {stop_id, stop_name, stop_lat, stop_lon}
    route_stop_ids = {}  # route_id -> [stop_id, ...]

    for route in eligible_routes:
        stops = get_route_stops(route)
        stop_ids = []
        for s in stops:
            sid = make_stop_id(s["name"], s["lat"], s["lng"])
            if sid not in all_stops:
                all_stops[sid] = {
                    "stop_id": sid,
                    "stop_name": s["name"],
                    "stop_lat": round(s["lat"], 7),
                    "stop_lon": round(s["lng"], 7),
                }
            stop_ids.append(sid)
        route_stop_ids[route["id"]] = stop_ids

    # stops.txt
    stops_rows = sorted(all_stops.values(), key=lambda x: x["stop_id"])
    write_csv(
        GTFS_DIR / "stops.txt",
        ["stop_id", "stop_name", "stop_lat", "stop_lon"],
        stops_rows,
    )

    # ── 5. calendar.txt ──
    # Two service patterns: weekday and daily (we'll use daily for simplicity
    # since Sri Lankan buses generally run 7 days a week).
    today = datetime.now()
    start_date = today.strftime("%Y%m%d")
    end_date = (today + timedelta(days=365)).strftime("%Y%m%d")

    calendar_rows = [
        {
            "service_id": "daily",
            "monday": 1,
            "tuesday": 1,
            "wednesday": 1,
            "thursday": 1,
            "friday": 1,
            "saturday": 1,
            "sunday": 1,
            "start_date": start_date,
            "end_date": end_date,
        }
    ]
    write_csv(
        GTFS_DIR / "calendar.txt",
        [
            "service_id",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
            "start_date",
            "end_date",
        ],
        calendar_rows,
    )

    # ── 6. shapes.txt ──
    shapes_rows = []
    routes_with_shapes = set()

    for route in eligible_routes:
        route_id = route["id"]

        # Prefer osm_polyline (detailed road geometry)
        if route.get("osm_polyline") and len(route["osm_polyline"]) >= 2:
            shape_id = f"shape_{route_id}"
            routes_with_shapes.add(route_id)
            for seq, point in enumerate(route["osm_polyline"], start=1):
                # osm_polyline is [lng, lat] format
                shapes_rows.append(
                    {
                        "shape_id": shape_id,
                        "shape_pt_lat": round(point[1], 7),
                        "shape_pt_lon": round(point[0], 7),
                        "shape_pt_sequence": seq,
                    }
                )
        else:
            # Fall back to stop coordinates as shape
            stops = get_route_stops(route)
            if len(stops) >= 2:
                shape_id = f"shape_{route_id}"
                routes_with_shapes.add(route_id)
                for seq, s in enumerate(stops, start=1):
                    shapes_rows.append(
                        {
                            "shape_id": shape_id,
                            "shape_pt_lat": round(s["lat"], 7),
                            "shape_pt_lon": round(s["lng"], 7),
                            "shape_pt_sequence": seq,
                        }
                    )

    write_csv(
        GTFS_DIR / "shapes.txt",
        ["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence"],
        shapes_rows,
    )

    # ── 7. trips.txt and stop_times.txt ──
    trips_rows = []
    stop_times_rows = []
    trip_counter = 0

    # Set of eligible route IDs for quick lookup
    eligible_route_ids = {r["id"] for r in eligible_routes}

    for tt_route_id, tt_data in timetables_data.items():
        # Only export trips for routes that are eligible (have geo data)
        if tt_route_id not in eligible_route_ids:
            continue

        route = route_by_id.get(tt_route_id)
        if not route:
            continue

        geo_stops = get_route_stops(route)
        if len(geo_stops) < 2:
            continue

        stop_ids = route_stop_ids.get(tt_route_id, [])
        if len(stop_ids) < 2:
            continue

        # Build a name->stop_id lookup for this route
        # Map timetable stop names to geo stops by fuzzy matching
        geo_stop_names = {s["name"].strip().lower(): i for i, s in enumerate(geo_stops)}

        cumulative_distances = compute_cumulative_distances(geo_stops)
        total_distance = cumulative_distances[-1] if cumulative_distances else 0

        for entry in tt_data.get("entries", []):
            direction = entry.get("direction", "outbound")
            direction_id = 0 if direction == "outbound" else 1
            stop_times = entry.get("stop_times", {})

            if not stop_times or len(stop_times) < 2:
                continue

            # Try to match timetable stop names to geo stops
            matched_times = []  # (geo_stop_index, stop_id, hours, minutes)

            for tt_stop_name, tt_time in stop_times.items():
                tt_name_lower = tt_stop_name.strip().lower()
                h, m = parse_time(tt_time)

                # Try exact match first
                if tt_name_lower in geo_stop_names:
                    idx = geo_stop_names[tt_name_lower]
                    matched_times.append((idx, stop_ids[idx], h, m))
                    continue

                # Try substring match
                best_idx = None
                for geo_name, geo_idx in geo_stop_names.items():
                    if tt_name_lower in geo_name or geo_name in tt_name_lower:
                        best_idx = geo_idx
                        break
                if best_idx is not None:
                    matched_times.append((best_idx, stop_ids[best_idx], h, m))

            if len(matched_times) < 2:
                # Not enough matches -- fall back: assign timetable stops to
                # geo stops by position (distribute evenly)
                tt_stop_list = list(stop_times.items())
                n_tt = len(tt_stop_list)
                n_geo = len(geo_stops)

                if n_tt <= n_geo:
                    # Map timetable stops to evenly spaced geo stops
                    indices = [round(i * (n_geo - 1) / (n_tt - 1)) for i in range(n_tt)]
                else:
                    # More timetable stops than geo stops; use first n_geo
                    indices = list(range(n_geo))
                    tt_stop_list = tt_stop_list[:n_geo]

                matched_times = []
                for i, (tt_stop_name, tt_time) in enumerate(tt_stop_list):
                    if i < len(indices):
                        geo_idx = indices[i]
                        h, m = parse_time(tt_time)
                        matched_times.append((geo_idx, stop_ids[geo_idx], h, m))

            if len(matched_times) < 2:
                continue

            # Sort by time to ensure correct sequence
            matched_times.sort(key=lambda x: (x[2], x[3]))

            trip_counter += 1
            trip_id = f"{tt_route_id}_{direction}_{trip_counter}"
            shape_id = (
                f"shape_{tt_route_id}"
                if tt_route_id in routes_with_shapes
                else ""
            )

            trips_rows.append(
                {
                    "trip_id": trip_id,
                    "route_id": tt_route_id,
                    "service_id": "daily",
                    "direction_id": direction_id,
                    "shape_id": shape_id,
                }
            )

            # Build stop_times for the matched stops
            for seq, (geo_idx, sid, h, m) in enumerate(matched_times, start=1):
                time_str = format_gtfs_time(h, m)
                stop_times_rows.append(
                    {
                        "trip_id": trip_id,
                        "arrival_time": time_str,
                        "departure_time": time_str,
                        "stop_id": sid,
                        "stop_sequence": seq,
                    }
                )

    # Also create trips for eligible routes WITHOUT timetable data
    # (one outbound + one inbound trip with estimated times based on distance)
    AVERAGE_BUS_SPEED_KMH = 30  # Average bus speed in Sri Lanka

    for route in eligible_routes:
        route_id = route["id"]
        if route_id in timetables_data:
            continue  # Already handled above

        geo_stops = get_route_stops(route)
        if len(geo_stops) < 2:
            continue
        sids = route_stop_ids.get(route_id, [])
        if len(sids) < 2:
            continue

        cumulative_distances = compute_cumulative_distances(geo_stops)
        total_dist = cumulative_distances[-1]
        if total_dist < 0.1:
            continue  # Skip routes with negligible distance

        shape_id = f"shape_{route_id}" if route_id in routes_with_shapes else ""

        # Generate one outbound trip starting at 06:00
        trip_counter += 1
        trip_id = f"{route_id}_outbound_{trip_counter}"
        trips_rows.append(
            {
                "trip_id": trip_id,
                "route_id": route_id,
                "service_id": "daily",
                "direction_id": 0,
                "shape_id": shape_id,
            }
        )

        base_h, base_m = 6, 0  # 06:00 departure
        for seq, (sid, dist) in enumerate(
            zip(sids, cumulative_distances), start=1
        ):
            travel_minutes = (dist / AVERAGE_BUS_SPEED_KMH) * 60
            total_minutes = base_h * 60 + base_m + travel_minutes
            h = int(total_minutes // 60)
            m = int(total_minutes % 60)
            time_str = format_gtfs_time(h, m)
            stop_times_rows.append(
                {
                    "trip_id": trip_id,
                    "arrival_time": time_str,
                    "departure_time": time_str,
                    "stop_id": sid,
                    "stop_sequence": seq,
                }
            )

        # Generate one inbound trip (reverse) starting at 14:00
        trip_counter += 1
        trip_id = f"{route_id}_inbound_{trip_counter}"
        trips_rows.append(
            {
                "trip_id": trip_id,
                "route_id": route_id,
                "service_id": "daily",
                "direction_id": 1,
                "shape_id": shape_id,
            }
        )

        reversed_sids = list(reversed(sids))
        reversed_dists = [
            total_dist - d for d in reversed(cumulative_distances)
        ]

        base_h, base_m = 14, 0  # 14:00 departure
        for seq, (sid, dist) in enumerate(
            zip(reversed_sids, reversed_dists), start=1
        ):
            travel_minutes = (dist / AVERAGE_BUS_SPEED_KMH) * 60
            total_minutes = base_h * 60 + base_m + travel_minutes
            h = int(total_minutes // 60)
            m = int(total_minutes % 60)
            time_str = format_gtfs_time(h, m)
            stop_times_rows.append(
                {
                    "trip_id": trip_id,
                    "arrival_time": time_str,
                    "departure_time": time_str,
                    "stop_id": sid,
                    "stop_sequence": seq,
                }
            )

    # Write trips.txt
    write_csv(
        GTFS_DIR / "trips.txt",
        ["trip_id", "route_id", "service_id", "direction_id", "shape_id"],
        trips_rows,
    )

    # Write stop_times.txt
    write_csv(
        GTFS_DIR / "stop_times.txt",
        [
            "trip_id",
            "arrival_time",
            "departure_time",
            "stop_id",
            "stop_sequence",
        ],
        stop_times_rows,
    )

    # ── 8. Create gtfs.zip ──
    gtfs_files = [
        "agency.txt",
        "routes.txt",
        "stops.txt",
        "trips.txt",
        "stop_times.txt",
        "calendar.txt",
        "shapes.txt",
    ]
    zip_path = GTFS_DIR / "gtfs.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in gtfs_files:
            fpath = GTFS_DIR / fname
            if fpath.exists():
                zf.write(fpath, fname)

    # ── 9. Print summary ──
    # Count unique routes in trips
    trip_route_ids = {t["route_id"] for t in trips_rows}

    print("=" * 60)
    print("  GTFS Export Summary — Mansariya")
    print("=" * 60)
    print(f"  Routes exported:        {len(routes_rows)}")
    print(f"  Stops exported:         {len(stops_rows)}")
    print(f"  Trips exported:         {len(trips_rows)}")
    print(f"  Stop-times exported:    {len(stop_times_rows)}")
    print(f"  Shapes exported:        {len(routes_with_shapes)}")
    print(f"  Routes with timetables: {len(trip_route_ids & set(timetables_data.keys()))}")
    print(f"  Routes (estimated):     {len(trip_route_ids - set(timetables_data.keys()))}")
    print("-" * 60)
    print(f"  Service period:         {start_date} — {end_date}")
    print(f"  Output directory:       {GTFS_DIR}")
    print(f"  GTFS zip:               {zip_path}")
    print(f"  Zip size:               {zip_path.stat().st_size / 1024:.1f} KB")
    print("=" * 60)


if __name__ == "__main__":
    build_gtfs()
