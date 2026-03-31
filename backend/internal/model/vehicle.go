package model

import "time"

// Confidence levels for bus position tracking.
const (
	ConfidenceLow      = "low"      // 1 contributor
	ConfidenceGood     = "good"     // 2 contributors
	ConfidenceVerified = "verified" // 3+ contributors
)

// Vehicle represents a fused bus position derived from one or more contributors.
type Vehicle struct {
	VirtualID        string    `json:"virtual_id"`
	RouteID          string    `json:"route_id"`
	Lat              float64   `json:"lat"`
	Lng              float64   `json:"lng"`
	SpeedKMH         float64   `json:"speed_kmh"`
	Bearing          float64   `json:"bearing"`
	ContributorCount int       `json:"contributor_count"`
	Confidence       string    `json:"confidence"`
	LastUpdate       time.Time `json:"last_update"`
	CrowdLevel       int       `json:"crowd_level,omitempty"`
	BusNumber        string    `json:"bus_number,omitempty"`
	Contributors     []string  `json:"-"`
}

// TripSegment records historical travel time between two stops for ETA learning.
type TripSegment struct {
	ID                int64     `json:"id"`
	RouteID           string    `json:"route_id"`
	FromStopID        string    `json:"from_stop_id"`
	ToStopID          string    `json:"to_stop_id"`
	TravelTimeSeconds int       `json:"travel_time_seconds"`
	SpeedKMH          float64   `json:"speed_kmh"`
	HourOfDay         int       `json:"hour_of_day"`
	DayOfWeek         int       `json:"day_of_week"`
	RecordedAt        time.Time `json:"recorded_at"`
}

// ETAResponse is the ETA for buses arriving at a specific stop.
type ETAResponse struct {
	RouteID string   `json:"route_id"`
	StopID  string   `json:"stop_id"`
	Buses   []BusETA `json:"buses"`
}

type BusETA struct {
	BusID            string  `json:"bus_id"`
	ETAMinutes       int     `json:"eta_minutes"`
	Confidence       string  `json:"confidence"`
	DistanceKM       float64 `json:"distance_km"`
	ContributorCount int     `json:"contributor_count"`
}
