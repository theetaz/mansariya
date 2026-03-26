package model

import (
	"time"

	"github.com/paulmach/orb"
)

type Stop struct {
	ID               string    `json:"id"`
	NameEN           string    `json:"name_en"`
	NameSI           string    `json:"name_si,omitempty"`
	NameTA           string    `json:"name_ta,omitempty"`
	Location         orb.Point `json:"location"`
	Source           string    `json:"source"`
	Confidence       float64   `json:"confidence"`
	ObservationCount int       `json:"observation_count"`
	CreatedAt        time.Time `json:"created_at"`
}

type DiscoveredStop struct {
	ID               string    `json:"id"`
	Location         orb.Point `json:"location"`
	ObservationCount int       `json:"observation_count"`
	AvgDwellSeconds  float64   `json:"avg_dwell_seconds"`
	NearestRouteIDs  []string  `json:"nearest_route_ids"`
	Status           string    `json:"status"`
	PromotedToStopID string    `json:"promoted_to_stop_id,omitempty"`
	FirstSeen        time.Time `json:"first_seen"`
	LastSeen         time.Time `json:"last_seen"`
}
