#!/usr/bin/env python3
"""
Apply Sinhala and Tamil translations to all route names.
Uses city_translations.json mapping + existing KNOWN_ROUTES corrections.
"""

import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ROUTES_FILE = BASE_DIR / "routes.json"
TRANSLATIONS_FILE = BASE_DIR / "collector" / "city_translations.json"


def main():
    with open(TRANSLATIONS_FILE) as f:
        city_map = json.load(f)

    with open(ROUTES_FILE) as f:
        routes = json.load(f)

    # Build case-insensitive lookup
    lookup_si = {}
    lookup_ta = {}
    for en, trans in city_map.items():
        lookup_si[en.lower()] = trans["si"]
        lookup_ta[en.lower()] = trans["ta"]

    translated = 0
    partial = 0

    for route in routes:
        if route.get("name_si") and route.get("name_ta"):
            continue  # Already has translations

        name_en = route.get("name_en", "")
        if not name_en or "(via" in name_en:
            continue

        # Remove parenthetical suffixes for translation: "Colombo - Kandy (AC Luxury)" -> "Colombo - Kandy"
        clean = re.sub(r'\s*\(.*?\)\s*$', '', name_en).strip()
        parts = re.split(r'\s*-\s*', clean, maxsplit=1)

        if len(parts) != 2:
            continue

        origin_en = parts[0].strip()
        dest_en = parts[1].strip()

        origin_si = lookup_si.get(origin_en.lower())
        origin_ta = lookup_ta.get(origin_en.lower())
        dest_si = lookup_si.get(dest_en.lower())
        dest_ta = lookup_ta.get(dest_en.lower())

        if origin_si and dest_si:
            suffix_match = re.search(r'\((.+?)\)$', name_en)
            suffix_si = ""
            suffix_ta = ""
            if suffix_match:
                suffix = suffix_match.group(1)
                # Translate common suffixes
                suffix_map = {
                    "AC Luxury": ("වායුසමනය සුඛෝපභෝගී", "ஏசி சொகுசு"),
                    "Intercity": ("අන්තර් නගර", "இடையூர்"),
                    "Semi Luxury": ("අර්ධ සුඛෝපභෝගී", "அரை சொகுசு"),
                    "Super Luxury": ("සුපිරි සුඛෝපභෝගී", "சூப்பர் சொகுசு"),
                    "Luxury": ("සුඛෝපභෝගී", "சொகுசு"),
                    "Express": ("ශීඝ්‍රගාමී", "விரைவு"),
                    "Normal": ("සාමාන්‍ය", "சாதாரண"),
                }
                if suffix in suffix_map:
                    suffix_si = f" ({suffix_map[suffix][0]})"
                    suffix_ta = f" ({suffix_map[suffix][1]})"

            route["name_si"] = f"{origin_si} - {dest_si}{suffix_si}"
            route["name_ta"] = f"{origin_ta} - {dest_ta}{suffix_ta}"
            translated += 1
        elif origin_si or dest_si:
            # Partial — at least set what we can
            si_origin = origin_si or origin_en
            si_dest = dest_si or dest_en
            ta_origin = origin_ta or origin_en
            ta_dest = dest_ta or dest_en
            route["name_si"] = f"{si_origin} - {si_dest}"
            route["name_ta"] = f"{ta_origin} - {ta_dest}"
            partial += 1

    # Stats
    total = len(routes)
    has_si = sum(1 for r in routes if r.get("name_si"))
    has_ta = sum(1 for r in routes if r.get("name_ta"))

    print(f"Translated: {translated} routes (full)")
    print(f"Partial:    {partial} routes (one city missing)")
    print(f"Sinhala:    {has_si}/{total} ({has_si/total*100:.1f}%)")
    print(f"Tamil:      {has_ta}/{total} ({has_ta/total*100:.1f}%)")

    # Show missing cities
    missing = set()
    for route in routes:
        if not route.get("name_si"):
            name = route.get("name_en", "")
            if name and "(via" not in name:
                clean = re.sub(r'\s*\(.*?\)\s*$', '', name)
                for part in re.split(r'\s*-\s*', clean):
                    part = part.strip()
                    if part and part.lower() not in lookup_si:
                        missing.add(part)

    if missing:
        print(f"\nMissing translations ({len(missing)} cities):")
        for m in sorted(missing)[:30]:
            print(f"  {m}")
        if len(missing) > 30:
            print(f"  ... and {len(missing) - 30} more")

    with open(ROUTES_FILE, 'w', encoding='utf-8') as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)
    print(f"\nWritten to {ROUTES_FILE}")


if __name__ == "__main__":
    main()
