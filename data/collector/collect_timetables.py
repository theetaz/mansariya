#!/usr/bin/env python3
"""
Mansariya Timetable Collector

1. Parse NTC timetable PDFs (route 17, 87)
2. Generate timetables from frequency_minutes + operating_hours for all other routes
3. Output timetables.json for database import
"""

import json
import re
from pathlib import Path
from datetime import datetime, timedelta

import warnings
warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent.parent
COLLECTOR_DIR = BASE_DIR / "collector"
TIMETABLE_DIR = COLLECTOR_DIR / "timetables"
ROUTES_FILE = BASE_DIR / "routes.json"
OUTPUT_FILE = BASE_DIR / "timetables.json"


def parse_route_17():
    """Parse Route 17 (Panadura - Kandy) timetable PDF."""
    pdf_path = TIMETABLE_DIR / "17.pdf"
    if not pdf_path.exists():
        return None

    import pdfplumber

    entries = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if not tables:
                continue

            table = tables[0]
            # Determine direction from page
            direction = "outbound" if page_idx == 0 else "inbound"

            # Stop columns (from header row)
            if direction == "outbound":
                stop_names = ["Panadura", "Moratuwa", "Nugegoda", "Malabe", "Kaduwela", "Avissawella", "Kandy"]
            else:
                stop_names = ["Kandy", "Peradeniya", "Kadugannawa", "Avissawella", "Kaduwela", "Malabe", "Panadura"]

            for row in table[1:]:  # skip header
                if not row or len(row) < 5:
                    continue

                # Extract times from the row
                times = {}
                time_cells = [c for c in row if c and re.search(r'\d{1,2}:\d{2}', str(c))]

                # Map times to stops based on column position
                col_offset = 4 if direction == "outbound" else 5  # time columns start after metadata
                for i, cell in enumerate(row[col_offset:]):
                    if cell and re.match(r'\d{1,2}:\d{2}', str(cell).strip()):
                        stop_idx = i
                        if stop_idx < len(stop_names):
                            times[stop_names[stop_idx]] = str(cell).strip()

                if not times:
                    continue

                # Extract service type
                svc = str(row[0] or "").strip()
                service_type = "Normal"
                if "සුඛ" in svc or "Semi" in svc.lower() or "අර්ධ" in svc:
                    service_type = "Semi-Luxury"
                elif "ලංගම" in svc or "SLTB" in svc.upper():
                    service_type = "SLTB"

                # Extract route number
                route_no = "17"
                for cell in row:
                    if cell:
                        rm = re.search(r'(17[/-]\d+|17)', str(cell))
                        if rm:
                            route_no = rm.group(1)
                            break

                # Get departure time (first time in sequence)
                origin_stop = stop_names[0]
                departure = times.get(origin_stop, "")
                if not departure and times:
                    departure = list(times.values())[0]

                if departure:
                    entries.append({
                        "route_id": route_no,
                        "direction": direction,
                        "departure_time": departure,
                        "service_type": service_type,
                        "stop_times": times,
                    })

    return entries


def parse_route_87():
    """Parse Route 87 (Colombo - Vauniya/Mannar) timetable PDF."""
    pdf_path = TIMETABLE_DIR / "87.pdf"
    if not pdf_path.exists():
        return None

    import pdfplumber

    entries = []
    stop_names_out = ["Colombo", "Puttalam", "Anuradhapura", "Medawachchi", "Vauniya", "Mannar"]
    stop_names_in = ["Vauniya", "Mannar", "Medawachchi", "Anuradhapura", "Puttalam", "Colombo"]

    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if not tables:
                continue

            direction = "outbound" if page_idx == 0 else "inbound"
            stop_names = stop_names_out if direction == "outbound" else stop_names_in

            for table in tables:
                for row in table[1:]:
                    if not row or len(row) < 3:
                        continue

                    times = {}
                    # First cell is bus identifier, rest are times by stop
                    for i, cell in enumerate(row[1:]):
                        if cell and re.match(r'\d{1,2}:\d{2}', str(cell).strip()):
                            if i < len(stop_names):
                                times[stop_names[i]] = str(cell).strip()

                    if not times:
                        continue

                    # Determine route sub-number from bus identifier
                    bus_id = str(row[0] or "")
                    route_no = "87"
                    if "87-2" in bus_id:
                        route_no = "87-2"
                    elif "4-3" in bus_id:
                        route_no = "4-3"
                    elif "(4)" in bus_id:
                        route_no = "4"

                    service_type = "Normal"
                    if "SL" in bus_id or "Semi" in bus_id:
                        service_type = "Semi-Luxury"

                    origin = stop_names[0]
                    departure = times.get(origin, list(times.values())[0] if times else "")

                    if departure:
                        entries.append({
                            "route_id": route_no,
                            "direction": direction,
                            "departure_time": departure,
                            "service_type": service_type,
                            "stop_times": times,
                        })

    return entries


def generate_from_frequency(route):
    """Generate timetable entries from frequency_minutes and operating_hours."""
    freq = route.get("frequency_minutes", 0)
    hours = route.get("operating_hours", "")

    if not freq or not hours:
        return None

    match = re.match(r'(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})', hours)
    if not match:
        return None

    start_h, start_m = int(match.group(1)), int(match.group(2))
    end_h, end_m = int(match.group(3)), int(match.group(4))
    start = start_h * 60 + start_m
    end = end_h * 60 + end_m

    entries = []
    current = start
    while current <= end:
        h = current // 60
        m = current % 60
        entries.append({
            "route_id": route["id"],
            "direction": "outbound",
            "departure_time": f"{h:02d}:{m:02d}",
            "service_type": route.get("service_type", "Normal"),
            "stop_times": {},
        })
        current += freq

    return entries


def main():
    print("=" * 60)
    print("Mansariya Timetable Collector")
    print("=" * 60)

    with open(ROUTES_FILE) as f:
        routes = json.load(f)

    all_timetables = {}

    # ── Parse NTC PDFs ──
    print("\n[1/2] Parsing NTC timetable PDFs...")

    entries_17 = parse_route_17()
    if entries_17:
        for e in entries_17:
            rid = e["route_id"]
            all_timetables.setdefault(rid, {"route_id": rid, "entries": [], "source": "ntc_pdf"})
            all_timetables[rid]["entries"].append(e)
        print(f"  Route 17: {len(entries_17)} departures parsed")

    entries_87 = parse_route_87()
    if entries_87:
        for e in entries_87:
            rid = e["route_id"]
            all_timetables.setdefault(rid, {"route_id": rid, "entries": [], "source": "ntc_pdf"})
            all_timetables[rid]["entries"].append(e)
        print(f"  Route 87: {len(entries_87)} departures parsed")

    pdf_routes = len(all_timetables)

    # ── Generate from frequency ──
    print("\n[2/2] Generating timetables from frequency data...")
    gen_count = 0
    for route in routes:
        rid = route["id"]
        if rid in all_timetables:
            continue

        entries = generate_from_frequency(route)
        if entries:
            all_timetables[rid] = {
                "route_id": rid,
                "entries": entries,
                "frequency_minutes": route.get("frequency_minutes"),
                "operating_hours": route.get("operating_hours"),
                "source": "generated",
            }
            gen_count += 1

    print(f"  Generated {gen_count} timetables from frequency data")

    # ── Stats ──
    total = len(all_timetables)
    total_entries = sum(len(t["entries"]) for t in all_timetables.values())

    print(f"\n{'=' * 60}")
    print(f"TIMETABLE SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Routes with timetable:    {total}")
    print(f"  From NTC PDFs:            {pdf_routes}")
    print(f"  Generated from frequency: {gen_count}")
    print(f"  Total departure entries:  {total_entries}")

    # Show sample
    for rid in ["17", "87", "1", "138"]:
        if rid in all_timetables:
            t = all_timetables[rid]
            deps = [e["departure_time"] for e in t["entries"][:5]]
            print(f"\n  Route {rid} ({t['source']}): {deps}{'...' if len(t['entries']) > 5 else ''}")

    # Write output
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_timetables, f, ensure_ascii=False, indent=2)
    print(f"\nWritten to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
