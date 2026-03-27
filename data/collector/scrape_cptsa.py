"""
Scrape Central Province Transport Services Authority (CPTSA) website
for Kandy-area bus route data.

Sources:
  1. Google Sheets API (via Apps Script) — route list (337 routes)
  2. Google Sheets API (via Apps Script) — fare sections with stop names (117 routes)
  3. Google Sheets API (via Apps Script) — fare tiers by section count
  4. KML files hosted at tsa.cp.gov.lk/Routes/ — route polylines (203 files)
  5. PHP endpoint /get-timetable-data.php — timetable entries (3,474 entries)

Output: data/collector/cptsa_routes.json

Linear issue: THE-61
"""

import json
import re
import sys
import time
import urllib.parse
from pathlib import Path
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HEADERS = {"User-Agent": "Mansariya/1.0 (bus-tracker research)"}
TIMEOUT = 60  # seconds

BASE_URL = "https://tsa.cp.gov.lk"
BUS_ROUTES_URL = f"{BASE_URL}/bus-routes.php"
TIMETABLE_URL = f"{BASE_URL}/get-timetable-data.php"
KML_BASE_URL = f"{BASE_URL}/Routes/"

# Google Apps Script endpoints (discovered from the site's JS)
ROUTES_API = "https://script.google.com/macros/s/AKfycbwPEPVtlFAXRizlp3VsgV1N2-zB1IPWFcmsVMcgcetj9h3YpCo7SPChYOdE6H0PZEOqNQ/exec"
SECTIONS_API = "https://script.google.com/macros/s/AKfycbzdbTx-eVkqeUxEwxvQny4FGOpySO3sE0EM3qBOBl07Dk1cpKSr8GF7Hr5Cf0n15Uli/exec"

OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = OUTPUT_DIR / "cptsa_routes.json"

# KML namespace
KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fetch_json(url: str, params: dict | None = None, label: str = "") -> dict | list:
    """Fetch JSON from a URL with error handling."""
    try:
        r = requests.get(url, headers=HEADERS, params=params, timeout=TIMEOUT)
        r.raise_for_status()
        data = r.json()
        print(f"  [OK] {label or url} — fetched successfully")
        return data
    except requests.RequestException as e:
        print(f"  [ERR] {label or url} — {e}")
        return {}
    except json.JSONDecodeError as e:
        print(f"  [ERR] {label or url} — invalid JSON: {e}")
        return {}


def parse_route_text(text: str) -> dict:
    """
    Parse a route option text like "Route - 408 Kalugala Kandy"
    into {route_no, origin, destination}.
    """
    # Remove "Route - " prefix and ".kml" suffix
    cleaned = re.sub(r"^Route\s*-\s*", "", text).strip()
    cleaned = re.sub(r"\.kml$", "", cleaned).strip()

    # Split: first token is route number, rest is location names
    parts = cleaned.split(None, 1)
    if len(parts) < 2:
        return {"route_no": cleaned, "origin": "", "destination": ""}

    route_no = parts[0]
    name_part = parts[1]

    # Handle "via" annotations — e.g. "Kandy Delthota (via Galaha)"
    via_match = re.search(r"\((?:via|Via)\s+(.+?)\)", name_part)
    via = via_match.group(1).strip() if via_match else ""

    # Remove the via annotation for origin/destination parsing
    name_clean = re.sub(r"\s*\((?:via|Via)\s+.+?\)", "", name_part).strip()

    # Also handle extra annotations in parens like "(Galthenna)"
    extra_match = re.search(r"\((.+?)\)", name_clean)
    extra = extra_match.group(1).strip() if extra_match else ""
    name_clean = re.sub(r"\s*\(.+?\)", "", name_clean).strip()

    # Split remaining into two location names
    # Most are "Origin Destination" but some places have multi-word names
    # We'll split on the last space as a heuristic, but prefer known patterns
    words = name_clean.split()
    if len(words) >= 2:
        # Simple heuristic: first word = origin, rest = destination
        # But many are two single-word place names
        origin = words[0]
        destination = " ".join(words[1:])
    else:
        origin = name_clean
        destination = ""

    # Normalize route number: replace underscores with slashes
    route_no = route_no.replace("_", "/")

    return {
        "route_no": route_no,
        "origin": origin,
        "destination": destination,
        "via": via,
        "extra": extra,
    }


def parse_route_name(route_name: str) -> tuple[str, str]:
    """
    Parse a route name like "Kandy-Nuwara Eliya" into (origin, destination).
    """
    # Split on " - " or "-"
    parts = re.split(r"\s*[-–]\s*", route_name, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return route_name.strip(), ""


def extract_kml_polyline(kml_text: str) -> list[list[float]]:
    """Extract polyline coordinates from KML text as [[lon, lat], ...]."""
    try:
        root = ET.fromstring(kml_text)
        coords_elem = root.find(".//kml:LineString/kml:coordinates", KML_NS)
        if coords_elem is None or not coords_elem.text:
            return []
        coords = []
        for point in coords_elem.text.strip().split():
            parts = point.split(",")
            if len(parts) >= 2:
                lon, lat = float(parts[0]), float(parts[1])
                coords.append([lon, lat])
        return coords
    except ET.ParseError:
        return []


# ---------------------------------------------------------------------------
# Data Collection Steps
# ---------------------------------------------------------------------------

def step1_fetch_route_list() -> list[dict]:
    """Fetch the master route list from Google Sheets API."""
    print("\n[Step 1] Fetching route list from Google Sheets API...")
    data = fetch_json(ROUTES_API, label="Routes API")
    routes = data.get("data", []) if isinstance(data, dict) else []
    print(f"  Found {len(routes)} routes in master list")
    return routes


def step2_fetch_kml_filenames() -> list[str]:
    """Scrape the bus-routes page to get KML filenames from the dropdown."""
    print("\n[Step 2] Scraping bus-routes.php for KML filenames...")
    try:
        r = requests.get(BUS_ROUTES_URL, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        select = soup.find("select", id="route-select")
        if not select:
            print("  [ERR] Could not find route-select dropdown")
            return []

        kml_files = []
        for option in select.find_all("option"):
            val = option.get("value", "").strip()
            if val and val.endswith(".kml"):
                kml_files.append(val)

        print(f"  Found {len(kml_files)} KML file references")
        return kml_files
    except requests.RequestException as e:
        print(f"  [ERR] Failed to fetch bus-routes page: {e}")
        return []


def step3_fetch_sections() -> dict:
    """Fetch fare sections (stop lists) from Google Sheets API."""
    print("\n[Step 3] Fetching fare sections (stop lists)...")
    data = fetch_json(SECTIONS_API, params={"type": "sections"}, label="Sections API")
    if isinstance(data, dict):
        print(f"  Found sections for {len(data)} routes")
        return data
    return {}


def step4_fetch_fares() -> dict:
    """Fetch fare tiers from Google Sheets API."""
    print("\n[Step 4] Fetching fare tiers...")
    data = fetch_json(SECTIONS_API, params={"type": "fares"}, label="Fares API")
    if isinstance(data, dict):
        print(f"  Found {len(data)} fare tiers")
        return data
    return {}


def step5_fetch_timetables() -> list[dict]:
    """Fetch timetable data from the PHP endpoint."""
    print("\n[Step 5] Fetching timetable data...")
    data = fetch_json(TIMETABLE_URL, label="Timetable API")
    entries = data.get("data", []) if isinstance(data, dict) else []
    print(f"  Found {len(entries)} timetable entries")
    return entries


def step6_fetch_kml_polylines(kml_files: list[str]) -> dict[str, list]:
    """Download KML files and extract polyline coordinates."""
    print(f"\n[Step 6] Downloading {len(kml_files)} KML files for polylines...")
    polylines = {}
    success = 0
    errors = 0

    for i, filename in enumerate(kml_files):
        url = KML_BASE_URL + urllib.parse.quote(filename)
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            coords = extract_kml_polyline(r.text)
            if coords:
                # Key by the filename stem (without .kml)
                key = filename.replace(".kml", "")
                polylines[key] = coords
                success += 1
            else:
                errors += 1
        except requests.RequestException:
            errors += 1

        # Progress
        if (i + 1) % 25 == 0 or (i + 1) == len(kml_files):
            print(f"  Progress: {i + 1}/{len(kml_files)} "
                  f"(OK: {success}, errors: {errors})")

        # Rate limit: small delay between requests
        if (i + 1) % 10 == 0:
            time.sleep(0.5)

    print(f"  Downloaded {success} polylines, {errors} errors")
    return polylines


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

def merge_data(
    route_list: list[dict],
    kml_files: list[str],
    sections: dict,
    fares: dict,
    timetables: list[dict],
    polylines: dict[str, list],
) -> list[dict]:
    """
    Merge all data sources into a unified list of route objects.

    Strategy:
    - Start with the master route list (337 routes) as the base.
    - Match sections/stops by route number.
    - Match timetable entries by route number.
    - Match KML polylines by route number.
    - Deduplicate bidirectional routes (KML has separate A->B and B->A).
    """
    print("\n[Assembly] Merging all data sources...")

    # Build a lookup for timetable entries by route number
    timetable_by_route: dict[str, list[dict]] = {}
    for entry in timetables:
        bus_route = entry.get("Bus Route", "")
        # Extract route number from "1 Kandy Colombo" -> "1"
        route_no = bus_route.split()[0] if bus_route else ""
        if route_no:
            timetable_by_route.setdefault(route_no, []).append({
                "from": entry.get("From", ""),
                "to": entry.get("To", ""),
                "departure_time": entry.get("Departure Time", ""),
                "operator": entry.get("Operator", ""),
                "service_type": entry.get("Type of Service", ""),
                "terminal": entry.get("Terminal", ""),
            })

    # Build a lookup for polylines by route number
    polyline_by_route: dict[str, list[dict]] = {}
    for key, coords in polylines.items():
        parsed = parse_route_text(key)
        route_no = parsed["route_no"]
        polyline_by_route.setdefault(route_no, []).append({
            "direction": f"{parsed['origin']} -> {parsed['destination']}",
            "points_count": len(coords),
            "start": coords[0] if coords else None,
            "end": coords[-1] if coords else None,
        })

    # Build a lookup for KML files by route number (for notes)
    kml_by_route: dict[str, list[str]] = {}
    for filename in kml_files:
        parsed = parse_route_text(filename)
        route_no = parsed["route_no"]
        kml_by_route.setdefault(route_no, []).append(filename)

    # Process master route list
    results = []
    seen_route_nos = set()

    for route_entry in route_list:
        raw_route_no = route_entry.get("Route Number", "").strip()
        route_name = route_entry.get("Route Name", "").strip()
        terminal = route_entry.get("Terminal", "").strip()

        if not raw_route_no:
            continue

        # Normalize route number: "47/5" stays, "47 (A/C)" -> "47"
        route_no = re.sub(r"\s*\(.*?\)\s*$", "", raw_route_no).strip()
        # Replace slashes in sub-routes for matching with underscore-based KML keys
        route_no_for_match = route_no.replace("/", "/")

        origin, destination = parse_route_name(route_name)

        # Get stops from sections data
        stops = []
        stops_si = []  # Sinhala names
        section_data = sections.get(route_no_for_match, [])
        if not section_data:
            # Try without the sub-route part
            base_route = route_no.split("/")[0]
            section_data = sections.get(base_route, [])
        for sec in section_data:
            en_name = sec.get("sectionNameEnglish", "").strip()
            si_name = sec.get("sectionNameLocal", "").strip()
            if en_name:
                stops.append(en_name)
            if si_name:
                stops_si.append(si_name)

        # Get timetable entries
        schedule = timetable_by_route.get(route_no, [])

        # Get polyline info
        polyline_info = polyline_by_route.get(route_no, [])

        # Check if we have a KML file
        has_kml = route_no in kml_by_route

        # Build notes
        notes_parts = []
        if "(A/C)" in raw_route_no or "(AC)" in route_name:
            notes_parts.append("Air-conditioned service")
        if terminal:
            notes_parts.append(f"Terminal: {terminal}")
        if has_kml:
            notes_parts.append("GPS polyline available")
        if schedule:
            operators = set(s["operator"] for s in schedule if s.get("operator"))
            service_types = set(s["service_type"] for s in schedule if s.get("service_type"))
            notes_parts.append(f"Operators: {', '.join(sorted(operators))}")
            notes_parts.append(f"Service types: {', '.join(sorted(service_types))}")
            notes_parts.append(f"{len(schedule)} scheduled departures")

        route_obj = {
            "route_no": raw_route_no,
            "name": route_name,
            "origin": origin,
            "destination": destination,
            "terminal": terminal,
            "stops": stops,
            "stops_si": stops_si,
            "schedule_count": len(schedule),
            "has_polyline": has_kml,
            "polyline_directions": len(polyline_info),
            "notes": "; ".join(notes_parts) if notes_parts else "",
        }

        results.append(route_obj)
        seen_route_nos.add(route_no)

    # Add any routes from KML that aren't in the master list
    kml_only_routes = set()
    for filename in kml_files:
        parsed = parse_route_text(filename)
        route_no = parsed["route_no"]
        if route_no not in seen_route_nos:
            kml_only_routes.add(route_no)

    for route_no in sorted(kml_only_routes):
        kml_names = kml_by_route.get(route_no, [])
        if kml_names:
            parsed = parse_route_text(kml_names[0])
            results.append({
                "route_no": route_no,
                "name": f"{parsed['origin']} - {parsed['destination']}",
                "origin": parsed["origin"],
                "destination": parsed["destination"],
                "terminal": "",
                "stops": [],
                "stops_si": [],
                "schedule_count": 0,
                "has_polyline": True,
                "polyline_directions": len(kml_names),
                "notes": "KML-only route (not in master list); GPS polyline available",
            })

    # Sort by route number
    def sort_key(r):
        # Extract numeric part for sorting
        num = re.sub(r"[^0-9]", "", r["route_no"].split("/")[0].split("(")[0])
        sub = r["route_no"].replace(num, "", 1) if num else r["route_no"]
        return (int(num) if num else 9999, sub)

    results.sort(key=sort_key)

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("CPTSA Bus Route Scraper — Kandy Area")
    print("Source: https://tsa.cp.gov.lk/bus-routes.php")
    print("=" * 60)

    # Step 1: Master route list
    route_list = step1_fetch_route_list()

    # Step 2: KML filenames from dropdown
    kml_files = step2_fetch_kml_filenames()

    # Step 3: Fare sections (stop lists)
    sections = step3_fetch_sections()

    # Step 4: Fare tiers
    fares = step4_fetch_fares()

    # Step 5: Timetable data
    timetables = step5_fetch_timetables()

    # Step 6: Download KML polylines
    polylines = step6_fetch_kml_polylines(kml_files)

    # Merge everything
    routes = merge_data(route_list, kml_files, sections, fares, timetables, polylines)

    # Build output
    output = {
        "source": "Central Province Transport Services Authority (CPTSA)",
        "source_url": "https://tsa.cp.gov.lk/bus-routes.php",
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "region": "Central Province (Kandy area)",
        "stats": {
            "total_routes": len(routes),
            "routes_with_stops": sum(1 for r in routes if r["stops"]),
            "routes_with_polyline": sum(1 for r in routes if r["has_polyline"]),
            "routes_with_schedule": sum(1 for r in routes if r["schedule_count"] > 0),
            "total_timetable_entries": len(timetables),
            "total_fare_sections": len(sections),
            "total_fare_tiers": len(fares),
            "kml_files_available": len(kml_files),
        },
        "fare_tiers": {
            "note": "Fare by number of sections traveled (effective March 2026)",
            "currency": "LKR",
            "tiers": {int(k): v for k, v in fares.items()} if fares else {},
        },
        "routes": routes,
    }

    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"Output written to: {OUTPUT_FILE}")
    print(f"Total routes: {len(routes)}")
    print(f"  With stops: {output['stats']['routes_with_stops']}")
    print(f"  With polyline: {output['stats']['routes_with_polyline']}")
    print(f"  With schedule: {output['stats']['routes_with_schedule']}")
    print(f"  Timetable entries: {output['stats']['total_timetable_entries']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
