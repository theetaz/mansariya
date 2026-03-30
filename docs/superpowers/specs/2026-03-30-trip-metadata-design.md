# Trip Metadata Popup — Design Spec

## Overview

When a user taps the tracking/share button on the Map screen, a bottom sheet modal appears with optional fields (route, bus number, crowd level) before GPS tracking begins. This metadata flows through the GPS pipeline to improve route assignment accuracy and provide crowd data to other commuters.

## Mobile UI

### TripStartModal (Bottom Sheet)

Appears when user taps the share/tracking FAB on the Map screen.

**Fields (all optional):**
1. **Route number** — text input with search/autocomplete from local SQLite route data. Shows route ID + name (e.g., "138 — Pettah - Kottawa").
2. **Bus number** — free text input for license plate (e.g., "NB-1234").
3. **Crowd level** — 4 tappable cards in a row:
   - 🟢 Not crowded (value: 1)
   - 🟡 Moderate (value: 2)
   - 🟠 Crowded (value: 3)
   - 🔴 Super crowded (value: 4)

**Buttons:**
- "Start Sharing" — primary green button, starts tracking with metadata
- "Skip & Share" — text button below, starts tracking without metadata

**Dismissing:** Swiping down or tapping outside cancels (no tracking started).

### Tracking Store Changes

Add to `useTrackingStore`:
- `routeId: string | null`
- `busNumber: string | null`
- `crowdLevel: number | null` (1-4)
- `setTripMeta(routeId, busNumber, crowdLevel)` action

### Location Tracker Changes

`locationTracker.ts` extended to accept and include metadata:
- `startTracking(meta?: { routeId?, busNumber?, crowdLevel? })` — stores metadata
- Every `sendGPSBatch` call includes the metadata fields alongside device_hash, session_id, pings

## Backend API Changes

### Extended GPSBatch Model

```go
type GPSBatch struct {
    DeviceHash string    `json:"device_hash"`
    SessionID  string    `json:"session_id"`
    Pings      []GPSPing `json:"pings"`
    RouteID    string    `json:"route_id,omitempty"`    // optional: user-selected route
    BusNumber  string    `json:"bus_number,omitempty"`  // optional: license plate
    CrowdLevel int       `json:"crowd_level,omitempty"` // optional: 1-4
}
```

The `POST /api/v1/gps/batch` handler already decodes the full struct — new fields are automatically accepted as optional (zero values when absent).

### Pipeline Changes

**Processor** — when `route_id` is present in the GPS batch (via MatchedTrace passthrough):
- Skip route inference, assign directly (same pattern as simulation `sim_` prefix)
- Higher confidence: user-provided route = "good" confidence minimum
- Store `crowd_level` and `bus_number` in DeviceState

**MatchedTrace** — extend to pass through metadata:
```go
type MatchedTrace struct {
    // existing fields...
    RouteID    string `json:"route_id,omitempty"`
    BusNumber  string `json:"bus_number,omitempty"`
    CrowdLevel int    `json:"crowd_level,omitempty"`
}
```

**MapMatcher** — pass RouteID, BusNumber, CrowdLevel from GPSBatch to MatchedTrace.

**DeviceState** — add CrowdLevel and BusNumber fields.

**Vehicle broadcast** — add CrowdLevel to the Vehicle model:
```go
type Vehicle struct {
    // existing fields...
    CrowdLevel int    `json:"crowd_level,omitempty"` // average across contributors, 0 if unknown
    BusNumber  string `json:"bus_number,omitempty"`
}
```

Clustering computes average crowd level across all contributors in the cluster.

### Trip Metadata Persistence

New table `trip_sessions` to store per-session metadata for analytics and future rewards:

```sql
CREATE TABLE trip_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_hash TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    route_id TEXT,
    bus_number TEXT,
    crowd_level INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    ping_count INTEGER DEFAULT 0,
    has_metadata BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_trip_sessions_device ON trip_sessions(device_hash);
CREATE INDEX idx_trip_sessions_route ON trip_sessions(route_id);
```

**When to insert:** On first GPS batch for a new session_id, create a row. Update ping_count on each batch. `has_metadata` = true if any of route_id/bus_number/crowd_level was provided.

**Purpose:** Track which users provide additional data so they can be rewarded more in v1.1 (when auth is added and device_hash links to user_id).

## Files Changed

### Backend
- Modify: `backend/internal/model/gps.go` — add RouteID, BusNumber, CrowdLevel to GPSBatch and MatchedTrace
- Modify: `backend/internal/model/vehicle.go` or model file — add CrowdLevel, BusNumber to Vehicle
- Modify: `backend/internal/pipeline/mapmatcher.go` — pass metadata fields through
- Modify: `backend/internal/pipeline/processor.go` — use route_id from batch, store crowd/bus in DeviceState
- Modify: `backend/internal/pipeline/clustering.go` — compute average crowd level in clusters
- Create: `backend/migrations/005_trip_sessions.up.sql` + down
- Create: `backend/internal/store/trip_store.go` — insert/update trip sessions
- Modify: `backend/internal/handler/gps.go` — create trip session on first batch per session
- Modify: `backend/cmd/server/main.go` — initialize trip store

### Mobile
- Create: `mobile/src/components/TripStartModal.tsx` — bottom sheet with route search, bus number input, crowd level cards
- Modify: `mobile/src/screens/MapScreen.tsx` — show modal on tracking button tap
- Modify: `mobile/src/services/locationTracker.ts` — include metadata in batches
- Modify: `mobile/src/services/api.ts` — extend sendGPSBatch with metadata fields
- Modify: `mobile/src/stores/useTrackingStore.ts` — add trip metadata state
