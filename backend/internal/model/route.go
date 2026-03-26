package model

import (
	"time"

	"github.com/paulmach/orb"
)

type Route struct {
	ID                 string         `json:"id"`
	NameEN             string         `json:"name_en"`
	NameSI             string         `json:"name_si"`
	NameTA             string         `json:"name_ta"`
	Operator           string         `json:"operator,omitempty"`
	ServiceType        string         `json:"service_type,omitempty"`
	FareLKR            int            `json:"fare_lkr,omitempty"`
	FrequencyMinutes   int            `json:"frequency_minutes,omitempty"`
	OperatingHours     string         `json:"operating_hours,omitempty"`
	Polyline           orb.LineString `json:"polyline,omitempty"`
	PolylineConfidence float64        `json:"polyline_confidence"`
	Source             string         `json:"source"`
	IsActive           bool           `json:"is_active"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

type RouteStop struct {
	RouteID                string  `json:"route_id"`
	StopID                 string  `json:"stop_id"`
	StopOrder              int     `json:"stop_order"`
	DistanceFromStartKM    float64 `json:"distance_from_start_km,omitempty"`
	TypicalArrivalOffsetMin int    `json:"typical_arrival_offset_min,omitempty"`
}
