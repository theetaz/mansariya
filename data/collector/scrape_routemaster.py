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
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup

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

    # Extract route number and name from the title / heading
    route_no = ""
    route_name = ""

    # Try the main heading first
    heading = soup.find("h1", class_="entry-title") or soup.find("h1")
    if heading:
        title_text = heading.get_text(strip=True)
    else:
        title_tag = soup.find("title")
        title_text = title_tag.get_text(strip=True) if title_tag else ""

    # Parse title like "Route 01 – Colombo to Kandy Intercity" or "EX 1-1 ..."
    # Common patterns:
    #   "Route 01 – Colombo to Kandy Intercity"
    #   "187↓ – Airport to Colombo (Fort)"
    #   "EX 1-1 – Makumbara Bus Stand to Matara"
    if title_text:
        # Remove site name suffix
        title_text = re.sub(r'\s*[-–|]\s*RouteMaster.*$', '', title_text, flags=re.IGNORECASE)
        title_text = title_text.strip()

        # Try to split into route number and name
        # Pattern: "Route XXX – Name" or "XXX – Name" or "XXX↓ – Name"
        match = re.match(
            r'(?:Route\s+)?([A-Za-z0-9\-/]+(?:\s*↓)?)\s*[-–]\s*(.+)',
            title_text,
            re.IGNORECASE
        )
        if match:
            route_no = match.group(1).replace("↓", "").strip()
            route_name = match.group(2).strip()
        else:
            # Fallback: extract from URL slug
            slug = url.rstrip("/").split("/")[-1]
            route_no = slug
            route_name = title_text

    # Fallback route number from URL
    if not route_no:
        slug = url.rstrip("/").split("/")[-1]
        route_no = slug

    # Find Google Maps direction URL
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

    # Build waypoints list: origin + intermediate waypoints + destination
    waypoints = []

    # Try to extract stop names from the page content
    # Look for text that mentions stops, typically in the content area
    content_div = soup.find("div", class_="entry-content") or soup.find("article")
    stop_names = []
    if content_div:
        # Look for lists of stops
        for li in content_div.find_all("li"):
            text = li.get_text(strip=True)
            if text and len(text) < 100:  # reasonable stop name length
                stop_names.append(text)

    if maps_data["origin"]:
        # Determine origin name from route_name or stop_names
        origin_name = ""
        dest_name = ""
        if route_name:
            # Try to split "X to Y" pattern
            to_match = re.match(r'(.+?)\s+to\s+(.+)', route_name, re.IGNORECASE)
            if to_match:
                origin_name = to_match.group(1).strip()
                dest_name = to_match.group(2).strip()

        waypoints.append({
            "lat": maps_data["origin"]["lat"],
            "lng": maps_data["origin"]["lng"],
            "name": origin_name or "Origin",
        })

        for i, wp in enumerate(maps_data["waypoints"]):
            # Try to match with a stop name if we have them
            wp_name = ""
            if i < len(stop_names):
                wp_name = stop_names[i]
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

    # Extract stops mentioned in the page (textual, may not have coordinates)
    stops = []
    # Look for bus stop links
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if "/bus_stops/" in href:
            stop_name = a_tag.get_text(strip=True)
            if stop_name:
                stops.append(stop_name)

    # Also look for structured stop lists in content
    if not stops and content_div:
        # Some pages list stops as text
        text = content_div.get_text()
        # Look for patterns like "via X, Y, Z" or stop listings
        via_match = re.search(r'via\s+(.+?)(?:\.|$)', text, re.IGNORECASE)
        if via_match:
            via_text = via_match.group(1)
            stops = [s.strip() for s in re.split(r'[,&]|\band\b', via_text) if s.strip()]

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
