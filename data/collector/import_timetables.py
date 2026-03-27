#!/usr/bin/env python3
"""
Import timetables.json into the PostgreSQL timetables table.

Usage:
  export DATABASE_URL="postgres://masariya:masariya@localhost:5433/masariya?sslmode=disable"
  python3 data/collector/import_timetables.py
"""

import json
import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("Installing psycopg2-binary...")
    os.system(f"{sys.executable} -m pip install psycopg2-binary -q")
    import psycopg2

BASE_DIR = Path(__file__).resolve().parent.parent
TIMETABLES_FILE = BASE_DIR / "timetables.json"


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        # Try loading from backend/.env
        env_file = BASE_DIR.parent / "backend" / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("DATABASE_URL="):
                    db_url = line.split("=", 1)[1]
                    break

    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    with open(TIMETABLES_FILE) as f:
        timetables = json.load(f)

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Clear existing timetable data
    cur.execute("DELETE FROM timetables")
    print(f"Cleared existing timetables")

    inserted = 0
    skipped = 0

    for route_id, tt in timetables.items():
        # Check if route exists in routes table
        cur.execute("SELECT id FROM routes WHERE id = %s", (route_id,))
        if not cur.fetchone():
            skipped += 1
            continue

        source = tt.get("source", "unknown")
        days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

        for entry in tt.get("entries", []):
            departure = entry.get("departure_time", "")
            if not departure:
                continue

            service_type = entry.get("service_type", "Normal")
            direction = entry.get("direction", "outbound")
            stop_times = json.dumps(entry.get("stop_times", {}))

            notes = f"{direction}"
            if source == "ntc_pdf":
                notes += " (NTC verified)"

            try:
                cur.execute("""
                    INSERT INTO timetables (route_id, departure_time, days, service_type, notes)
                    VALUES (%s, %s, %s, %s, %s)
                """, (route_id, departure, days, service_type, notes))
                inserted += 1
            except Exception as e:
                print(f"  Error inserting {route_id} {departure}: {e}")
                conn.rollback()
                continue

    conn.commit()
    cur.close()
    conn.close()

    print(f"\nImported {inserted} timetable entries for {len(timetables) - skipped} routes")
    print(f"Skipped {skipped} routes (not in routes table)")


if __name__ == "__main__":
    main()
