#!/usr/bin/env python3
"""
Download and parse the NTC Route Wise Permits PDF.
Extracts unique route numbers with English origin/destination names.

The PDF is text-based (not tabular). Each permit entry is a single line like:
  S/N  PermitNo  BusNo  RouteNo  ServiceType  ValidDate  Origin  Destination
followed by owner details on subsequent lines.

Bus plates sometimes have a -R prefix glued to the route number, e.g.:
  ND-5101-R98 means plate ND-5101, route 98
  NG-4543-R002-001 means plate NG-4543, route 002-001

Service type "SUPER LUXURY" is sometimes split across two lines.
Serial numbers may contain commas (e.g. 1,182).
"""

import json
import os
import re
import sys
import warnings
from collections import defaultdict

import pdfplumber
import requests

# Suppress SSL warnings for verify=False
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

PDF_URL = "https://ntc.gov.lk/Bus_info/ROUTE%20WISE%20PERMITS.pdf"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_PATH = os.path.join(SCRIPT_DIR, "ntc_permits.pdf")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "ntc_permits_parsed.json")


def download_pdf():
    """Download the NTC permits PDF."""
    print(f"Downloading PDF from {PDF_URL} ...")
    try:
        resp = requests.get(PDF_URL, verify=False, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"ERROR: Failed to download PDF: {e}")
        sys.exit(1)

    with open(PDF_PATH, "wb") as f:
        f.write(resp.content)
    size_mb = len(resp.content) / (1024 * 1024)
    print(f"Saved {size_mb:.1f} MB to {PDF_PATH}")


def parse_pdf():
    """
    Parse the PDF by extracting text from each page and matching permit lines.

    Returns a list of dicts with keys: route_no, origin, destination, service_type.
    """
    print(f"Parsing PDF: {PDF_PATH} ...")

    if not os.path.exists(PDF_PATH):
        print(f"ERROR: PDF file not found at {PDF_PATH}")
        sys.exit(1)

    # Known service types
    service_types_set = {
        "LUXURY", "SEMI LUXURY", "NORMAL", "EXPRESS",
        "SUPER LUXURY", "INTERCITY", "HIGHWAY", "SUPER",
    }

    # Main regex for a permit line.
    # Format: S/N  PermitNo  BusPlate[(-R)RouteNo]  [RouteNo]  ServiceType  Date  Origin  Destination
    #
    # The bus plate can have -R<route> glued on:
    #   NC-3875-R1  -> plate NC-3875, route 1
    #   NG-4543-R002-001 -> plate NG-4543, route 002-001
    # Or the plate and route are separate:
    #   NE-6030 002-001
    #
    # We handle both cases.

    # Service type alternation used in both patterns.
    # Includes SEMI-LUX (truncated form of SEMI LUXURY found in the PDF).
    svc_alt = (
        r"(?:LUXURY|SEMI LUXURY|SEMI-LUX|NORMAL|EXPRESS|"
        r"SUPER LUXURY|INTERCITY|HIGHWAY|SUPER)"
    )

    # Pattern A: plate with -R<route> glued on
    # e.g., "18 F12335 NG-4543-R002-001 LUXURY 3/31/2026 COLOMBO GALLE"
    #        "330 9687 NC-3875-R1 LUXURY 3/21/2026 COLOMBO KANDY"
    pattern_a = re.compile(
        r"^(\d[\d,]*)\s+"                             # S/N (may have commas)
        r"([A-Z]?\d+)\s+"                              # Permit No
        r"([A-Z]{2}-\d{4,5})-R"                        # Bus plate (2L-4/5D) ending with -R
        r"(\S+)\s+"                                     # Route No (everything until space)
        r"(" + svc_alt + r")\s+"                       # Service type
        r"(\d{1,2}/\d{1,2}/\d{4})\s+"                 # Valid Date
        r"(.+)$"                                        # Origin + Destination
    )

    # Pattern B: plate and route separate (no -R suffix on plate)
    # e.g., "1 9840 NF-2500 001 LUXURY 6/19/2026 COLOMBO KANDY"
    # Bus plate is strictly 2 uppercase + dash + 4-5 digits, nothing more.
    pattern_b = re.compile(
        r"^(\d[\d,]*)\s+"                              # S/N
        r"([A-Z]?\d+)\s+"                              # Permit No
        r"([A-Z]{2}-\d{4,5})\s+"                       # Bus plate (strict: 2L-4/5D only)
        r"(\S+)\s+"                                     # Route No
        r"(" + svc_alt + r")\s+"                       # Service type
        r"(\d{1,2}/\d{1,2}/\d{4})\s+"                 # Valid Date
        r"(.+)$"                                        # Origin + Destination
    )

    # Pattern D: route numbers with "EX " prefix (space inside route no)
    # e.g., "211 F13828 NC-0855 EX 1-18 SUPER 12/26/2026 COLOMBO MATARA"
    pattern_d = re.compile(
        r"^(\d[\d,]*)\s+"                              # S/N
        r"([A-Z]?\d+)\s+"                              # Permit No
        r"([A-Z]{2}-\d{4,5})\s+"                       # Bus plate
        r"(EX\s+\S+)\s+"                               # Route No with EX prefix
        r"(" + svc_alt + r")\s+"                       # Service type
        r"(\d{1,2}/\d{1,2}/\d{4})\s+"                 # Valid Date
        r"(.+)$"                                        # Origin + Destination
    )

    # Pattern C: HW-plates with 5-digit plates where route is glued on without -R
    # e.g., "694 0539 HW-4469048-008 NORMAL ..." means plate HW-44690, route 48-008
    # HW plates have 5 digits, and the route starts immediately after.
    pattern_c = re.compile(
        r"^(\d[\d,]*)\s+"                              # S/N
        r"([A-Z]?\d+)\s+"                              # Permit No
        r"(HW-\d{5})"                                  # Bus plate (HW-5D)
        r"(\S+)\s+"                                     # Route No glued on
        r"(" + svc_alt + r")\s+"                       # Service type
        r"(\d{1,2}/\d{1,2}/\d{4})\s+"                 # Valid Date
        r"(.+)$"                                        # Origin + Destination
    )

    permits = []
    skipped_no_od = 0
    skipped_bad_route = 0
    matched_a = 0
    matched_b = 0
    matched_c = 0

    with pdfplumber.open(PDF_PATH) as pdf:
        total_pages = len(pdf.pages)
        print(f"Total pages: {total_pages}")

        # Track current section service type for "SUPER\nLUXURY" split
        current_section_service = None

        for page_num, page in enumerate(pdf.pages):
            if page_num % 100 == 0:
                print(f"  Processing page {page_num + 1}/{total_pages} ...")

            text = page.extract_text()
            if not text:
                continue

            lines = text.split("\n")

            for line_idx, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue

                # Detect section headers like "LUXURY 605" or "NORMAL 2,003"
                # Also handle "SEMI-LUX" section headers
                section_match = re.match(
                    r"^(LUXURY|SEMI LUXURY|SEMI-LUX\w*|NORMAL|EXPRESS|"
                    r"SUPER LUXURY|INTERCITY|HIGHWAY|SUPER)\s+[\d,]+$",
                    line,
                )
                if section_match:
                    current_section_service = section_match.group(1)
                    continue

                # Try pattern A first (plate-R-route glued)
                m = pattern_a.match(line)
                if m:
                    matched_a += 1
                    serial, permit_no, bus_no, route_no, service_type, valid_date, origin_dest = (
                        m.group(1), m.group(2), m.group(3), m.group(4),
                        m.group(5), m.group(6), m.group(7),
                    )
                else:
                    # Try pattern C (HW plates with glued route, no -R)
                    m = pattern_c.match(line)
                    if m:
                        matched_c += 1
                        serial, permit_no, bus_no, route_no, service_type, valid_date, origin_dest = (
                            m.group(1), m.group(2), m.group(3), m.group(4),
                            m.group(5), m.group(6), m.group(7),
                        )
                    else:
                        # Try pattern D (EX route with space)
                        m = pattern_d.match(line)
                        if m:
                            matched_b += 1  # count with B for simplicity
                            serial, permit_no, bus_no, route_no, service_type, valid_date, origin_dest = (
                                m.group(1), m.group(2), m.group(3), m.group(4),
                                m.group(5), m.group(6), m.group(7),
                            )
                        else:
                            # Try pattern B (separate plate and route)
                            m = pattern_b.match(line)
                            if m:
                                matched_b += 1
                                serial, permit_no, bus_no, route_no, service_type, valid_date, origin_dest = (
                                    m.group(1), m.group(2), m.group(3), m.group(4),
                                    m.group(5), m.group(6), m.group(7),
                                )
                            else:
                                continue

                # Handle "SUPER" service type -> check if next line is "LUXURY"
                if service_type == "SUPER":
                    if line_idx + 1 < len(lines) and lines[line_idx + 1].strip() == "LUXURY":
                        service_type = "SUPER LUXURY"

                # Normalize service type abbreviations
                if service_type.startswith("SEMI-LUX"):
                    service_type = "SEMI LUXURY"

                # Handle truncated route numbers: if route ends with /
                # check the next line for continuation.
                # e.g., "EX01-051/" on this line + "035" on next = "EX01-051/035"
                # e.g., "EX02/EX0" on this line + "4/602" on next = "EX02/EX04/602"
                route_clean = route_no.strip()
                if route_clean.endswith("/") or (
                    route_clean.startswith("EX") and re.search(r"[A-Z]$", route_clean)
                ):
                    if line_idx + 1 < len(lines):
                        next_line = lines[line_idx + 1].strip()
                        # Continuation is a short line with digits/dashes/slashes
                        if next_line and re.match(r"^[\d/\-]+$", next_line) and len(next_line) <= 15:
                            route_clean = route_clean + next_line

                # Validate route number - should start with a digit or EX
                if not re.match(r"^(\d|EX)", route_clean):
                    skipped_bad_route += 1
                    continue

                # Parse origin and destination
                origin, destination = parse_origin_destination(origin_dest.strip())

                if not origin and not destination:
                    skipped_no_od += 1
                    continue

                permits.append({
                    "route_no": route_clean,
                    "origin": origin,
                    "destination": destination,
                    "service_type": service_type,
                })

    print(f"\nMatched: {matched_a} pattern A (plate-R-route), {matched_b} pattern B (separate), {matched_c} pattern C (HW-plate)")
    print(f"Extracted {len(permits)} permit records")
    print(f"Skipped: {skipped_no_od} no origin/dest, {skipped_bad_route} bad route number")
    return permits


def parse_origin_destination(text: str) -> tuple:
    """
    Parse origin and destination from text like "COLOMBO KANDY".

    Most entries have two single-word place names. Some have multi-word
    names. We use a heuristic: the first word is the origin, and the
    remaining words form the destination, UNLESS we recognize a known
    multi-word origin.
    """
    if not text:
        return ("", "")

    text = text.strip()

    # Known multi-word place names that appear as origins
    multi_word_origins = [
        "NUWARA ELIYA", "NUWARAELIYA", "MOUNT LAVINIA",
        "NANU OYA", "HATTON DICKOYA",
    ]

    for place in multi_word_origins:
        if text.startswith(place + " "):
            origin = place
            destination = text[len(place):].strip()
            return (origin, destination)

    # Split into words
    words = text.split()

    if len(words) == 0:
        return ("", "")
    elif len(words) == 1:
        return (words[0], "")
    elif len(words) == 2:
        return (words[0], words[1])
    else:
        # For 3+ words: first word is origin, rest is destination.
        # This is correct for most entries like "COLOMBO NUWARA ELIYA"
        return (words[0], " ".join(words[1:]))


def normalize_route_no(route_no: str) -> str:
    """
    Normalize route numbers for grouping.
    - Strip leading zeros: 001 -> 1, 002-001 -> 2-001
    - Keep structure otherwise
    """
    # Handle routes like 001, 002-001, 004-009
    parts = re.split(r"([/-])", route_no)
    normalized = []
    for part in parts:
        if re.match(r"^\d+$", part):
            normalized.append(str(int(part)))  # strip leading zeros
        else:
            normalized.append(part)
    return "".join(normalized)


def aggregate_routes(permits):
    """Aggregate permits by normalized route number to get unique routes with counts."""
    route_map = defaultdict(lambda: {
        "raw_route_nos": defaultdict(int),
        "origins": defaultdict(int),
        "destinations": defaultdict(int),
        "service_types": defaultdict(int),
        "count": 0,
    })

    for p in permits:
        raw = p["route_no"]
        key = normalize_route_no(raw)
        route_map[key]["count"] += 1
        route_map[key]["raw_route_nos"][raw] += 1
        if p["origin"]:
            route_map[key]["origins"][p["origin"]] += 1
        if p["destination"]:
            route_map[key]["destinations"][p["destination"]] += 1
        if p["service_type"]:
            route_map[key]["service_types"][p["service_type"]] += 1

    # Build final list - pick most common origin/destination for each route
    def route_sort_key(route_no):
        """Sort routes: numeric first (by value), then alphanumeric."""
        m = re.match(r"^(\d+)", route_no)
        if m:
            return (0, int(m.group(1)), route_no)
        return (1, 0, route_no)

    results = []
    for route_no, data in sorted(route_map.items(), key=lambda x: route_sort_key(x[0])):
        origin = max(data["origins"], key=data["origins"].get) if data["origins"] else ""
        destination = max(data["destinations"], key=data["destinations"].get) if data["destinations"] else ""
        service_type = max(data["service_types"], key=data["service_types"].get) if data["service_types"] else ""

        results.append({
            "route_no": route_no,
            "origin": origin,
            "destination": destination,
            "service_type": service_type,
            "count": data["count"],
        })

    return results


def main():
    # Step 1: Download PDF
    if not os.path.exists(PDF_PATH):
        download_pdf()
    else:
        size_mb = os.path.getsize(PDF_PATH) / (1024 * 1024)
        print(f"PDF already exists at {PDF_PATH} ({size_mb:.1f} MB), skipping download")

    # Step 2: Parse PDF and extract permits
    permits = parse_pdf()

    if not permits:
        print("ERROR: No permits could be extracted from the PDF")
        print("The PDF structure may have changed. Manual inspection needed.")
        sys.exit(1)

    # Step 3: Aggregate by route
    routes = aggregate_routes(permits)

    # Step 4: Save to JSON
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)
    print(f"\nSaved {len(routes)} unique routes to {OUTPUT_PATH}")

    # Step 5: Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total permits parsed:    {len(permits)}")
    print(f"Unique route numbers:    {len(routes)}")

    # Count by service type
    svc_counts = defaultdict(int)
    for p in permits:
        svc_counts[p["service_type"] or "Unknown"] += 1
    print(f"\nService type breakdown:")
    for svc, count in sorted(svc_counts.items(), key=lambda x: -x[1]):
        print(f"  {svc}: {count}")

    print(f"\nSample entries (first 30):")
    print(f"{'Route':<14} {'Origin':<25} {'Destination':<25} {'Service':<15} {'Count':>5}")
    print("-" * 84)
    for r in routes[:30]:
        print(
            f"{r['route_no']:<14} "
            f"{r['origin'][:24]:<25} "
            f"{r['destination'][:24]:<25} "
            f"{r['service_type'][:14]:<15} "
            f"{r['count']:>5}"
        )

    if len(routes) > 30:
        print(f"\n... and {len(routes) - 30} more routes")


if __name__ == "__main__":
    main()
