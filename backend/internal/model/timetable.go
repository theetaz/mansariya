package model

import "time"

// Timetable represents a scheduled departure from the origin stop.
type Timetable struct {
	ID            int       `json:"id"`
	RouteID       string    `json:"route_id"`
	DepartureTime string    `json:"departure_time"` // "HH:MM"
	Days          []string  `json:"days"`            // ["MON","TUE",...]
	ServiceType   string    `json:"service_type"`
	Notes         string    `json:"notes,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// EnrichedRouteStop extends RouteStop with timing and fare data.
type EnrichedRouteStop struct {
	RouteID            string  `json:"route_id"`
	StopID             string  `json:"stop_id"`
	StopOrder          int     `json:"stop_order"`
	DistanceFromStartKM float64 `json:"distance_from_start_km,omitempty"`
	TypicalDurationMin  int    `json:"typical_duration_min,omitempty"`
	FareFromStartLKR    int    `json:"fare_from_start_lkr,omitempty"`
	// Joined stop data
	StopNameEN string  `json:"stop_name_en,omitempty"`
	StopNameSI string  `json:"stop_name_si,omitempty"`
	StopNameTA string  `json:"stop_name_ta,omitempty"`
	StopLat    float64 `json:"stop_lat,omitempty"`
	StopLng    float64 `json:"stop_lng,omitempty"`
	IsTerminal bool    `json:"is_terminal,omitempty"`
}

// JourneyResult represents a single route option for a from→to journey.
type JourneyResult struct {
	Route          Route              `json:"route"`
	BoardStop      EnrichedRouteStop  `json:"board_stop"`
	ExitStop       EnrichedRouteStop  `json:"exit_stop"`
	StopsBetween   int                `json:"stops_between"`
	DurationMin    int                `json:"estimated_duration_min"`
	FareLKR        int                `json:"fare_lkr"`
	LiveBusCount   int                `json:"live_bus_count"`
	NextBusETAMin  int                `json:"next_bus_eta_min,omitempty"`
}

// JourneyResponse is the API response for journey search.
type JourneyResponse struct {
	Origin      Stop            `json:"origin"`
	Destination Stop            `json:"destination"`
	Journeys    []JourneyResult `json:"journeys"`
}
