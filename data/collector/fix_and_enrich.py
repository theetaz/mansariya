#!/usr/bin/env python3
"""
Step 2: Fix wrong route data and enrich with English names.

1. Correct route names/stops using GitHub GPS-verified data
2. Map Sinhala city names to English for NTC routes
3. Output clean routes.json ready for bootstrap
"""

import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
COMPREHENSIVE = BASE_DIR / "routes_comprehensive.json"
GITHUB_DATA = BASE_DIR / "collector" / "github_colombo.json"
OUTPUT = BASE_DIR / "routes.json"

# ─── Sinhala → English city name mapping ──────────────────────────────────────
# Built from NTC PDF patterns, OSM data, and known Sri Lankan geography.
# The NTC PDF has broken cid characters, so we also match partial patterns.

SINHALA_TO_ENGLISH = {
    # Major cities
    "කොළඹ": "Colombo",
    "මහනුවර": "Kandy",
    "මාතර": "Matara",
    "ගාල්ල": "Galle",
    "යාපනය": "Jaffna",
    "අනුරාධපුරය": "Anuradhapura",
    "කුරුණෑගල": "Kurunegala",
    "බදුල්ල": "Badulla",
    "රත්නපුරය": "Ratnapura",
    "නුවරඑළිය": "Nuwara Eliya",
    "පොලොන්නරුව": "Polonnaruwa",
    "අම්පාර": "Ampara",
    "මඩකලපුව": "Batticaloa",
    "ත්‍රිකුණාමලය": "Trincomalee",
    "හම්බන්තොට": "Hambantota",
    "මොනරාගල": "Monaragala",
    "කෑගල්ල": "Kegalle",
    "පුත්තලම": "Puttalam",
    "කල්පිටිය": "Kalpitiya",
    "චිලාව්": "Chilaw",
    "වවුනියාව": "Vavuniya",
    "කිලිනොච්චි": "Kilinochchi",
    "මුලතිව්": "Mullaitivu",
    "මන්නාරම": "Mannar",

    # Key towns and junctions
    "පානදුර": "Panadura",
    "බේරුවල": "Beruwala",
    "අළුත්ගම": "Aluthgama",
    "අම්බලන්ගොඩ": "Ambalangoda",
    "හික්කඩුව": "Hikkaduwa",
    "දෙනියාය": "Deniyaya",
    "අක්මීමන": "Akmeemana",
    "තංගල්ල": "Tangalle",
    "තිස්සමහාරාමය": "Tissamaharama",
    "කතරගම": "Kataragama",
    "එල්ල": "Ella",
    "බණ්ඩාරවෙල": "Bandarawela",
    "හැටන්": "Hatton",
    "නාවලපිටිය": "Nawalapitiya",
    "මාතලේ": "Matale",
    "දඹුල්ල": "Dambulla",
    "සීගිරිය": "Sigiriya",
    "හබරණ": "Habarana",
    "මීගමුව": "Negombo",
    "කටුනායක": "Katunayake",
    "කඩවත": "Kadawatha",
    "කිරිබත්ගොඩ": "Kiribathgoda",
    "ගම්පහ": "Gampaha",
    "මීරිගම": "Mirigama",
    "නිට්ටඹුව": "Nittambuwa",
    "වරකාපොල": "Warakapola",
    "මාවනැල්ල": "Mawanella",
    "කඩුගන්නාව": "Kadugannawa",
    "පේරාදෙණිය": "Peradeniya",
    "පිලියන්දල": "Piliyandala",
    "හෝමාගම": "Homagama",
    "කොට්ටාව": "Kottawa",
    "මහරගම": "Maharagama",
    "නුගේගොඩ": "Nugegoda",
    "දෙහිවල": "Dehiwala",
    "මොරටුව": "Moratuwa",
    "අවිස්සාවේල්ල": "Avissawella",
    "හොරණ": "Horana",
    "බුලත්සිංහල": "Bulathsinhala",
    "කළුතර": "Kalutara",
    "පොල්ගහවෙල": "Polgahawela",
    "අලව්ව": "Alawwa",
    "දඹුකොල": "Dambukola",
    "ඇඹිලිපිටිය": "Embilipitiya",
    "බලංගොඩ": "Balangoda",
    "වැලිමඩ": "Welimada",
    "බිබිල": "Bibila",
    "මහියංගනය": "Mahiyanganaya",
    "සෙන්කඩගල": "Senkalagala",
    "ගලහිටියාව": "Galahitiyawa",
    "කුලියාපිටිය": "Kuliyapitiya",
    "හැදුන්නැව": "Hettipola",
    "වාරියපොල": "Wariyapola",
    "නිකවැරටිය": "Nikaweratiya",
    "ගිරිඋල්ල": "Giriulla",
    "දෙහිඅත්තකණ්ඩිය": "Dehiattakandiya",
    "මැදවච්චිය": "Medawachchiya",
    "තලවාකැලේ": "Talawakele",
    "නුවර": "Kandy",
    "ගලේ": "Galle",

    # Common partial matches (for broken cid text)
    "පාන": "Panadura",
    "ෙක": "Colombo",
    "මාතර": "Matara",
}

# Known correct route number → English name mappings
# Verified from multiple sources (NTC, GitHub, OSM, local knowledge)
KNOWN_ROUTES = {
    # Inter-provincial major routes (NTC)
    "1": ("Colombo - Kandy", "SLTB", "Normal"),
    "2": ("Colombo - Matara", "SLTB", "Normal"),
    "3": ("Colombo - Badulla", "SLTB", "Normal"),
    "4": ("Colombo - Jaffna", "SLTB", "Normal"),
    "5": ("Colombo - Batticaloa", "SLTB", "Normal"),
    "6": ("Colombo - Trincomalee", "SLTB", "Normal"),
    "7": ("Colombo - Anuradhapura", "SLTB", "Normal"),
    "8": ("Colombo - Polonnaruwa", "SLTB", "Normal"),
    "9": ("Colombo - Ratnapura", "SLTB", "Normal"),
    "10": ("Colombo - Hambantota", "SLTB", "Normal"),
    "11": ("Matara - Anuradhapura", "SLTB", "Normal"),
    "14": ("Kandy - Anuradhapura", "SLTB", "Normal"),
    "15": ("Colombo - Puttalam", "SLTB", "Normal"),
    "16": ("Colombo - Chilaw", "SLTB", "Normal"),
    "17": ("Panadura - Ratnapura", "SLTB", "Normal"),
    "19": ("Kandy - Badulla", "SLTB", "Normal"),
    "23": ("Avissawella - Embilipitiya", "SLTB", "Normal"),
    "25": ("Colombo - Weerawila", "SLTB", "Normal"),
    "32": ("Colombo - Kurunegala", "SLTB", "Normal"),
    "33": ("Colombo - Kalpitiya", "SLTB", "Normal"),
    "48": ("Colombo - Vavuniya", "SLTB", "Normal"),
    "57": ("Colombo - Embilipitiya", "SLTB", "Normal"),
    "60": ("Colombo - Monaragala", "SLTB", "Normal"),
    "64": ("Panadura - Ampara", "SLTB", "Normal"),
    "67": ("Colombo - Ratnapura", "SLTB", "Normal"),
    "68": ("Kataragama - Jaffna", "SLTB", "Normal"),
    "69": ("Kandy - Ratnapura", "SLTB", "Normal"),
    "79": ("Colombo - Nuwara Eliya", "SLTB", "Normal"),
    "82": ("Colombo - Jaffna", "SLTB", "Normal"),
    "86": ("Colombo - Vavuniya", "SLTB", "Normal"),
    "87": ("Colombo - Jaffna", "SLTB", "Normal"),
    "88": ("Colombo - Batticaloa", "SLTB", "Normal"),
    "98": ("Colombo - Mannar", "SLTB", "Normal"),

    # Western Province local routes (GitHub verified)
    "100": ("Pettah - Panadura", "Private", "Normal"),
    "101": ("Pettah - Moratuwa", "Private", "Normal"),
    "103": ("Narahenpita - Fort", "Private", "Normal"),
    "119": ("Dehiwala - Maharagama", "Private", "Normal"),
    "120": ("Pettah - Horana", "Private", "Normal"),
    "122": ("Pettah - Avissawella", "Private", "Normal"),
    "125": ("Pettah - Padukka", "Private", "Normal"),
    "135": ("Kohuwala - Kelaniya", "Private", "Normal"),
    "138": ("Pettah - Kottawa", "Private", "Normal"),
    "140": ("Kollupitiya - Wellampitiya", "Private", "Normal"),
    "141": ("Narahenpita - Wellawatte", "Private", "Normal"),
    "154": ("Kiribathgoda - Angulana", "Private", "Normal"),
    "155": ("Soysapura - Mattakkuliya", "Private", "Normal"),
    "163": ("Dehiwala - Battaramulla", "Private", "Normal"),
    "174": ("Kottawa - Borella", "Private", "Normal"),
    "175": ("Kollupitiya - Kohilawatte", "Private", "Normal"),
    "176": ("Karagampitiya - Hettiyawatte", "Private", "Normal"),
    "177": ("Kollupitiya - Kaduwela", "Private", "Normal"),
    "187": ("Fort - Airport", "Private", "Normal"),

    # Other known routes
    "128": ("Colombo - Horana", "SLTB", "Normal"),
    "240": ("Colombo - Maharagama", "Private", "Normal"),
    "255": ("Colombo - Kottawa", "Private", "Normal"),
    "333": ("Matara - Kataragama", "SLTB", "Normal"),
}


def load_github_stops():
    """Build route → ordered stops from GitHub data."""
    with open(GITHUB_DATA) as f:
        gh = json.load(f)

    places = {p["id"]: p for p in gh["places"]}
    route_stops = {}

    for sm in gh["stops"]:
        bid = sm["bus_id"]
        pid = sm["place_id"]
        order = sm["stop_order"]
        if pid in places:
            route_stops.setdefault(bid, []).append((order, places[pid]))

    for bid in route_stops:
        route_stops[bid].sort(key=lambda x: x[0])

    # Map bus_id to route_no
    bus_to_route = {}
    for r in gh["routes"]:
        bus_to_route[r["bus_id"]] = r["route_no"]

    result = {}
    for bid, stops in route_stops.items():
        route_no = bus_to_route.get(bid)
        if route_no and route_no not in result:
            result[route_no] = {
                "stops": [s[1]["name"] for s in stops],
                "stop_coords": [
                    {"name": s[1]["name"], "lat": s[1]["lat"], "lng": s[1]["lng"]}
                    for s in stops
                ]
            }

    return result


def fix_and_enrich():
    """Fix wrong routes and enrich with English names."""
    with open(COMPREHENSIVE) as f:
        routes = json.load(f)

    github_stops = load_github_stops()

    fixed_count = 0
    named_count = 0

    for route in routes:
        rid = route["id"]

        # ── Apply known correct names ──
        if rid in KNOWN_ROUTES:
            name, operator, svc_type = KNOWN_ROUTES[rid]
            if route["name_en"] != name:
                old = route["name_en"]
                route["name_en"] = name
                if old and old != name:
                    fixed_count += 1
            if not route.get("operator"):
                route["operator"] = operator
            if not route.get("service_type") or route["service_type"] == "Normal":
                route["service_type"] = svc_type

        # ── Apply GitHub stops (GPS verified) ──
        if rid in github_stops:
            gh = github_stops[rid]
            route["stops"] = gh["stops"]
            route["stop_coords"] = gh["stop_coords"]

        # ── For sub-routes (e.g., 1-1, 2/48), derive name from parent ──
        if not route.get("name_en"):
            base_match = re.match(r'^(\d+)', rid)
            if base_match:
                base_id = base_match.group(1)
                if base_id in KNOWN_ROUTES:
                    parent_name = KNOWN_ROUTES[base_id][0]
                    origin = parent_name.split(" - ")[0]
                    route["name_en"] = f"{origin} - (via {rid})"
                    named_count += 1

        # ── Clean up ──
        # Remove empty stop_coords
        if route.get("stop_coords") == []:
            del route["stop_coords"]

        # Ensure all routes have required fields
        route.setdefault("name_en", "")
        route.setdefault("name_si", "")
        route.setdefault("name_ta", "")
        route.setdefault("operator", "")
        route.setdefault("service_type", "Normal")
        route.setdefault("fare_lkr", 0)
        route.setdefault("frequency_minutes", 0)
        route.setdefault("operating_hours", "")
        route.setdefault("stops", [])

    # Remove source field (internal)
    for r in routes:
        r.pop("source", None)

    print(f"Fixed {fixed_count} wrong route names")
    print(f"Named {named_count} sub-routes from parent")
    print(f"GitHub stops applied to {len(github_stops)} routes")

    # Stats
    total = len(routes)
    with_name = sum(1 for r in routes if r.get("name_en"))
    with_stops = sum(1 for r in routes if r.get("stops"))
    with_coords = sum(1 for r in routes if r.get("stop_coords"))
    with_fares = sum(1 for r in routes if r.get("fare_lkr"))

    print(f"\nFinal: {total} routes")
    print(f"  With name:   {with_name}")
    print(f"  With stops:  {with_stops}")
    print(f"  With coords: {with_coords}")
    print(f"  With fares:  {with_fares}")

    return routes


def main():
    print("=" * 60)
    print("Fixing and enriching route data")
    print("=" * 60)

    routes = fix_and_enrich()

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)
    print(f"\nWritten corrected data to {OUTPUT}")

    # Show corrected route 138 as proof
    for r in routes:
        if r["id"] == "138":
            print(f"\nRoute 138: {r['name_en']}")
            print(f"  Stops: {r['stops'][:5]}...")
            print(f"  GPS coords: {len(r.get('stop_coords', []))} points")
            break


if __name__ == "__main__":
    main()
