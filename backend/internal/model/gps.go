package model

const (
	GPSEventPing    = "ping"
	GPSEventStarted = "started"
	GPSEventStopped = "stopped"
)

// GPSBatch represents a batch of GPS pings from a single device.
type GPSBatch struct {
	DeviceHash       string    `json:"device_hash"`
	SessionID        string    `json:"session_id"`
	ContributorID    string    `json:"contributor_id,omitempty"`
	Pings            []GPSPing `json:"pings"`
	RouteID          string    `json:"route_id,omitempty"`
	BusNumber        string    `json:"bus_number,omitempty"`
	CrowdLevel       int       `json:"crowd_level,omitempty"`
	EventType        string    `json:"event_type,omitempty"`
	IdentityVersion  int       `json:"identity_version,omitempty"`
	SessionStartedAt int64     `json:"session_started_at,omitempty"`
	BatchSeq         int64     `json:"batch_seq,omitempty"`
}

// GPSPing is a single GPS observation from a phone.
type GPSPing struct {
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	Timestamp int64   `json:"ts"`
	Accuracy  float64 `json:"acc"`
	Speed     float64 `json:"spd"` // m/s
	Bearing   float64 `json:"brg"`
}

// MatchedPoint is a GPS ping after Valhalla map-matching.
type MatchedPoint struct {
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
	EdgeID  int64   `json:"edge_id,omitempty"`
	Speed   float64 `json:"speed"`
	Bearing float64 `json:"bearing"`
}

// MatchedTrace is the result of map-matching a GPS batch.
type MatchedTrace struct {
	DeviceHash       string         `json:"device_hash"`
	SessionID        string         `json:"session_id"`
	ContributorID    string         `json:"contributor_id,omitempty"`
	Points           []MatchedPoint `json:"points"`
	AvgSpeed         float64        `json:"avg_speed"` // km/h
	AvgBearing       float64        `json:"avg_bearing"`
	RouteID          string         `json:"route_id,omitempty"`
	BusNumber        string         `json:"bus_number,omitempty"`
	CrowdLevel       int            `json:"crowd_level,omitempty"`
	EventType        string         `json:"event_type,omitempty"`
	IdentityVersion  int            `json:"identity_version,omitempty"`
	SessionStartedAt int64          `json:"session_started_at,omitempty"`
	BatchSeq         int64          `json:"batch_seq,omitempty"`
}
