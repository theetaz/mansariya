# Mansariya

Sri Lanka's first crowdsource-powered bus tracking system.

**No hardware on buses. No paid APIs. Just passengers' phones.**

Mansariya turns commuters' smartphones into GPS sensors. When you ride a bus with the app open, your phone silently contributes location data. The server infers which bus you're on, fuses data from multiple passengers, and broadcasts the bus position to everyone else — in real time.

## Why

- Sri Lanka has **1,000+ bus routes** but **zero public real-time tracking data**.
- No GTFS feed exists. The NTC publishes routes as PDFs.
- Google Maps shows static routes but has no live position data.
- 65,000+ buses operated by SLTB and thousands of private operators — installing GPS hardware is a non-starter.

Mansariya solves this with crowdsourcing: passengers become the sensors.

## How It Works

```
Phone GPS (5s intervals)
    → Server receives batch
    → Snap to roads (Valhalla map-matching)
    → Identify which bus route (spatial inference)
    → Cluster co-moving passengers = 1 bus
    → Broadcast fused position via WebSocket
    → Other passengers see the bus on their map
```

Even a single contributor produces a usable bus position. With 2+, accuracy improves. With 3+, the position is verified.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go, Chi, pgx, go-redis |
| Data Pipeline | Redis Streams → Redis Pub/Sub |
| Database | PostgreSQL 16 + PostGIS |
| Map Matching | Valhalla Meili (self-hosted) |
| Mobile | React Native (bare workflow), TypeScript |
| Maps | MapLibre + OpenFreeMap (free, no API key) |
| Infrastructure | Hetzner CX32 (~$9/month), Cloudflare CDN |

**Total map costs: $0.** No Google Maps dependency.

## Project Structure

```
masariya/
├── backend/          # Go backend — single binary
│   ├── cmd/server/   # Entry point
│   ├── internal/     # All packages (handler, pipeline, spatial, store, ws)
│   └── migrations/   # PostgreSQL + PostGIS schema
├── mobile/           # React Native app (Android-first)
│   └── src/          # Screens, services, stores, hooks, i18n
├── infra/            # Docker Compose, Dockerfiles, Valhalla config, nginx
└── data/             # Route data files
```

## Getting Started

### Prerequisites

- Go 1.23+
- Node.js 20+
- Docker & Docker Compose
- Android SDK (for mobile)

### Backend

```bash
# Start PostgreSQL + Redis
make infra-up

# Run database migrations
export DATABASE_URL="postgres://masariya:masariya@localhost:5432/masariya?sslmode=disable"
make migrate-up

# Start the server
make backend-dev
# → http://localhost:8000/health
```

### Mobile

```bash
# Install dependencies
make mobile-install

# Run on Android
make mobile-android
```

### Run Tests

```bash
# Backend
make backend-test

# Mobile
cd mobile && npx jest
```

## Key Features (MVP)

- **Live bus tracking** on a map with real-time position updates
- **Route search** in Sinhala, Tamil, and English
- **"I'm on a bus" mode** — one tap to start contributing
- **ETA estimates** based on current bus position and historical speed
- **Offline route browsing** — all 1,000+ routes cached locally
- **Privacy-first** — no accounts, no login, device hash rotates daily

## Architecture

The GPS processing pipeline:

1. **Ingestion** — Phone POSTs GPS batch → written to Redis Stream instantly
2. **Map Matching** — Worker reads stream, calls Valhalla to snap GPS to roads
3. **Route Inference** — Matched trace compared against 1,000+ route polylines via R-tree spatial index
4. **Vehicle Clustering** — DBSCAN groups co-moving devices on same route into virtual vehicles
5. **Broadcast** — Fused position published via Redis Pub/Sub → WebSocket to all connected clients

## Trilingual Support

The app supports all three of Sri Lanka's languages:

- **Sinhala** (සිංහල) — default
- **Tamil** (தமிழ்)
- **English**

Route names, stop names, and all UI strings are available in all three languages.

## Privacy

Mansariya is designed so that **even the server operator cannot reconstruct an individual's travel history**:

- No user accounts or login
- Device identifiers rotate every 24 hours
- Raw GPS data is discarded within 10 minutes
- Only aggregated, anonymous data is persisted
- GPS trace storage is opt-in only

## Contributing

Contributions are welcome. Please read the project guidelines before submitting PRs.

### Development Approach

This project follows **Test-Driven Development (TDD)**. Write tests first, then implement. All PRs should include tests for new functionality.

## License

TBD
