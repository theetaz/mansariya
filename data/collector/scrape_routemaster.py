#!/usr/bin/env python3
"""
Scrape routemaster.lk to extract Sri Lankan bus route data with GPS waypoints.

Fetches all route pages from the sitemap, extracts route numbers, names,
and GPS coordinates from embedded Google Maps direction links.

Usage:
    python3 scrape_routemaster.py

Output:
    data/collector/routemaster_routes.json
"""

import json
import re
import sys
import time
import warnings
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

BASE_URL = "https://routemaster.lk"
HEADERS = {
    "User-Agent": "Mansariya/1.0 (bus-tracker research)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
REQUEST_DELAY = 1  # seconds between requests
OUTPUT_PATH = Path(__file__).parent / "routemaster_routes.json"


def fetch(url: str, retries: int = 3) -> requests.Response | None:
    """Fetch a URL with retries and polite delay."""
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            return resp
        except requests.exceptions.HTTPError as e:
            if resp.status_code == 404:
                print(f"  [404] Not found: {url}")
                return None
            print(f"  [HTTP {resp.status_code}] {url} (attempt {attempt + 1}/{retries})")
        except requests.exceptions.RequestException as e:
            print(f"  [Error] {e} (attempt {attempt + 1}/{retries})")
        if attempt < retries - 1:
            time.sleep(REQUEST_DELAY * 2)
    return None


def get_route_urls_from_sitemap() -> list[str]:
    """Parse the bus route sitemap to get all route page URLs."""
    print("Fetching sitemap index...")
    resp = fetch(f"{BASE_URL}/sitemap_index.xml")
    if not resp:
        resp = fetch(f"{BASE_URL}/sitemap.xml")
    if not resp:
        print("ERROR: Could not fetch sitemap")
        return []

    # Find the bus sitemap URL
    soup = BeautifulSoup(resp.text, "html.parser")
    bus_sitemap_url = None
    for loc in soup.find_all("loc"):
        if "base_bus-sitemap" in loc.text:
            bus_sitemap_url = loc.text.strip()
            break

    if not bus_sitemap_url:
        # Try direct URL
        bus_sitemap_url = f"{BASE_URL}/base_bus-sitemap.xml"

    print(f"Fetching bus route sitemap: {bus_sitemap_url}")
    time.sleep(REQUEST_DELAY)
    resp = fetch(bus_sitemap_url)
    if not resp:
        print("ERROR: Could not fetch bus route sitemap")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    urls = []
    for loc in soup.find_all("loc"):
        url = loc.text.strip()
        # Skip the index page itself
        if url.rstrip("/") == f"{BASE_URL}/bus":
            continue
        if "/bus/" in url:
            urls.append(url)

    print(f"Found {len(urls)} route URLs in sitemap")
    return urls


def parse_google_maps_url(url: str) -> dict:
    """Extract origin, destination, and waypoints from a Google Maps directions URL."""
    result = {"origin": None, "destination": None, "waypoints": []}

    try:
        decoded = unquote(url)
        parsed = urlparse(decoded)
        params = parse_qs(parsed.query)

        # Extract origin
        if "origin" in params:
            origin_str = params["origin"][0]
            parts = origin_str.split(",")
            if len(parts) == 2:
                result["origin"] = {
                    "lat": float(parts[0].strip()),
                    "lng": float(parts[1].strip()),
                }

        # Extract destination
        if "destination" in params:
            dest_str = params["destination"][0]
            parts = dest_str.split(",")
            if len(parts) == 2:
                result["destination"] = {
                    "lat": float(parts[0].strip()),
                    "lng": float(parts[1].strip()),
                }

        # Extract waypoints (pipe-separated)
        if "waypoints" in params:
            wp_str = params["waypoints"][0]
            if wp_str.strip():
                for wp in wp_str.split("|"):
                    wp = wp.strip()
                    if not wp:
                        continue
                    parts = wp.split(",")
                    if len(parts) == 2:
                        try:
                            result["waypoints"].append({
                                "lat": float(parts[0].strip()),
                                "lng": float(parts[1].strip()),
                            })
                        except ValueError:
                            continue

    except Exception as e:
        print(f"  [Warning] Failed to parse Maps URL: {e}")

    return result


def extract_route_data(url: str, html: str) -> dict | None:
    """Extract route data from a route page HTML."""
    soup = BeautifulSoup(html, "html.parser")

    # --- Extract route number from the h1 heading ---
    # The h1 looks like "Sri Lanka bus route number: 01" or "Sri Lanka bus route number: EX 1-1"
    route_no = ""
    heading = soup.find("h1", class_="entry-title") or soup.find("h1")
    if heading:
        h1_text = heading.get_text(strip=True)
        # Extract the route number after "route number:"
        rn_match = re.search(r'route\s+number:\s*(.+)', h1_text, re.IGNORECASE)
        if rn_match:
            route_no = rn_match.group(1).strip()
            # Clean up arrows
            route_no = route_no.replace("↓", "").replace("↑", "").strip()

    # Fallback route number from URL slug
    if not route_no:
        slug = url.rstrip("/").split("/")[-1]
        route_no = slug

    # --- Extract From/To and stops from the card-body div ---
    origin_name = ""
    dest_name = ""
    stops = []

    card_body = soup.find("div", class_="card-body")
    if card_body:
        # The card-body text follows the pattern:
        #   "From: <origin>To: <destination>Also stops at:<stop1><stop2>..."
        # Split by pipe to get structured text
        card_text = card_body.get_text("|", strip=True)

        # Extract "From: X"
        from_match = re.search(r'From:\s*([^|]+)', card_text)
        if from_match:
            origin_name = from_match.group(1).strip()
            # Clean trailing "To:" if the parser merged them
            origin_name = re.sub(r'\s*To:.*$', '', origin_name).strip()

        # Extract "To: X"
        to_match = re.search(r'To:\s*([^|]+)', card_text)
        if to_match:
            dest_name = to_match.group(1).strip()
            # Clean trailing text
            dest_name = re.sub(r'\s*Also stops at:.*$', '', dest_name).strip()

        # Extract stops: paragraphs after "Also stops at:" and before
        # descriptive text / "Open in Google Maps"
        also_stops_match = re.search(r'Also stops at:\|(.+?)(?:\|Open in Google Maps|$)', card_text)
        if also_stops_match:
            raw_stops = also_stops_match.group(1)
            for stop in raw_stops.split("|"):
                stop = stop.strip()
                # Filter out non-stop text (long descriptions, links, etc.)
                if (stop
                        and len(stop) < 80
                        and not stop.startswith("If you")
                        and not stop.startswith("Alternatively")
                        and not stop.startswith("Busses")
                        and not stop.startswith("Buses")
                        and not stop.startswith("(")
                        and not stop.startswith("We have")
                        and "click here" not in stop.lower()
                        and "book online" not in stop.lower()
                        and "routemaster" not in stop.lower()):
                    stops.append(stop)

    # Build the route name from origin and destination
    route_name = ""
    if origin_name and dest_name:
        route_name = f"{origin_name} to {dest_name}"
    elif origin_name:
        route_name = origin_name
    elif dest_name:
        route_name = dest_name

    # --- Extract GPS coordinates from Google Maps direction link ---
    maps_data = {"origin": None, "destination": None, "waypoints": []}

    # Search in all links
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if "google.com/maps/dir" in href:
            maps_data = parse_google_maps_url(href)
            break

    # Also search in the raw HTML for Maps URLs (sometimes in onclick or JS)
    if not maps_data["origin"]:
        maps_pattern = re.compile(
            r'https?://(?:www\.)?google\.com/maps/dir/?\?[^"\s<>]+',
            re.IGNORECASE
        )
        for match in maps_pattern.finditer(html):
            maps_data = parse_google_maps_url(match.group(0))
            if maps_data["origin"]:
                break

    # --- Build waypoints list: origin + intermediate waypoints + destination ---
    waypoints = []

    if maps_data["origin"]:
        waypoints.append({
            "lat": maps_data["origin"]["lat"],
            "lng": maps_data["origin"]["lng"],
            "name": origin_name or "Origin",
        })

        for i, wp in enumerate(maps_data["waypoints"]):
            # Try to match with a stop name if available
            wp_name = ""
            if i < len(stops):
                wp_name = stops[i]
            waypoints.append({
                "lat": wp["lat"],
                "lng": wp["lng"],
                "name": wp_name or f"Waypoint {i + 1}",
            })

        if maps_data["destination"]:
            waypoints.append({
                "lat": maps_data["destination"]["lat"],
                "lng": maps_data["destination"]["lng"],
                "name": dest_name or "Destination",
            })

    return {
        "route_no": route_no,
        "name": route_name,
        "waypoints": waypoints,
        "stops": stops,
        "source_url": url,
    }


def main():
    print("=" * 60)
    print("RouteMaster.lk Bus Route Scraper")
    print("=" * 60)
    print()

    # Step 1: Get all route URLs from sitemap
    route_urls = get_route_urls_from_sitemap()
    if not route_urls:
        print("No route URLs found. Exiting.")
        sys.exit(1)

    # Step 2: Scrape each route page
    routes = []
    errors = 0
    skipped = 0

    for i, url in enumerate(route_urls):
        print(f"[{i + 1}/{len(route_urls)}] Scraping: {url}")

        resp = fetch(url)
        if not resp:
            errors += 1
            continue

        route_data = extract_route_data(url, resp.text)
        if route_data:
            routes.append(route_data)
            wp_count = len(route_data["waypoints"])
            stop_count = len(route_data["stops"])
            if wp_count > 0:
                print(f"  -> {route_data['route_no']}: {route_data['name']} "
                      f"({wp_count} waypoints, {stop_count} stops)")
            else:
                print(f"  -> {route_data['route_no']}: {route_data['name']} "
                      f"(no GPS data, {stop_count} stops)")
                skipped += 1
        else:
            print(f"  -> Could not extract data")
            errors += 1

        # Polite delay between requests
        if i < len(route_urls) - 1:
            time.sleep(REQUEST_DELAY)

    # Step 3: Save results
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(routes, f, indent=2, ensure_ascii=False)

    # Step 4: Print summary
    routes_with_gps = [r for r in routes if len(r["waypoints"]) > 0]
    routes_with_stops = [r for r in routes if len(r["stops"]) > 0]
    total_waypoints = sum(len(r["waypoints"]) for r in routes)

    print()
    print("=" * 60)
    print("SCRAPING COMPLETE")
    print("=" * 60)
    print(f"Total route pages scraped: {len(route_urls)}")
    print(f"Routes extracted:          {len(routes)}")
    print(f"Routes with GPS waypoints: {len(routes_with_gps)}")
    print(f"Routes with stop names:    {len(routes_with_stops)}")
    print(f"Total waypoint coords:     {total_waypoints}")
    print(f"Errors / 404s:             {errors}")
    print(f"Routes without GPS data:   {skipped}")
    print(f"Output saved to:           {OUTPUT_PATH}")
    print()

    # Print route list
    print("Routes found:")
    print("-" * 60)
    for r in sorted(routes, key=lambda x: x["route_no"]):
        wp = len(r["waypoints"])
        st = len(r["stops"])
        gps_info = f"{wp} pts" if wp > 0 else "no GPS"
        print(f"  {r['route_no']:20s} {r['name'][:40]:40s} [{gps_info}, {st} stops]")


if __name__ == "__main__":
    main()
