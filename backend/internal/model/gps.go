package model

// GPSBatch represents a batch of GPS pings from a single device.
type GPSBatch struct {
	DeviceHash string    `json:"device_hash"`
	SessionID  string    `json:"session_id"`
	Pings      []GPSPing `json:"pings"`
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
	DeviceHash string         `json:"device_hash"`
	SessionID  string         `json:"session_id"`
	Points     []MatchedPoint `json:"points"`
	AvgSpeed   float64        `json:"avg_speed"` // km/h
	AvgBearing float64        `json:"avg_bearing"`
}
