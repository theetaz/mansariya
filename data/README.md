# Sri Lanka Bus Route Dataset

Open dataset of Sri Lanka's bus routes — the first structured, machine-readable collection of the country's 1,000+ bus routes with trilingual stop names.

## Why This Exists

Sri Lanka has no public GTFS feed. The NTC publishes routes as PDFs. Google Maps shows static routes with zero real-time data. This dataset fills that gap.

## Data Sources

| Source | What it provides | Status |
|--------|-----------------|--------|
| NTC (ntc.gov.lk) | Route numbers, origin/destination, fare tables | Official but PDF-only |
| srilankabusfare.com | 1,003 routes with English, Sinhala, Tamil stop names | Structured, web-scraped |
| OpenStreetMap | Some bus route relations tagged `route=bus` | Partial georeferenced |
| NTC fare PDFs (2026) | 80+ inter-provincial routes with fare breakdowns | Confirms route existence |

## Data Format

Each route in `routes.json`:
```json
{
  "id": "1",
  "name_en": "Colombo - Kandy",
  "name_si": "කොළඹ - මහනුවර",
  "name_ta": "கொழும்பு - கண்டி",
  "operator": "SLTB",
  "service_type": "Normal",
  "fare_lkr": 350,
  "frequency_minutes": 15,
  "operating_hours": "04:30-22:00",
  "stops": ["Colombo Fort", "Peliyagoda", ...]
}
```

## License

This data is released under **ODbL (Open Database License)** — the same license as OpenStreetMap. Free to use, share, and build upon with attribution.

## Contributing

Found an error? Missing a route? Open an issue or submit a PR.
