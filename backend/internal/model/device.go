package model

import "time"

// Classification labels for device tracking state.
const (
	ClassificationNoise     = "noise"
	ClassificationPotential = "potential"
	ClassificationCluster   = "cluster"
	ClassificationConfirmed = "confirmed"
	QualityOK               = "ok"
	QualityLowAccuracy      = "low_accuracy"
	QualityOutOfRegion      = "out_of_service_region"
	FreshnessActive         = "active"
	FreshnessSuspect        = "suspect"
	FreshnessDisconnected   = "disconnected"
)

// DeviceInfo represents the current state and classification of a contributing device.
type DeviceInfo struct {
	ContributorID        string    `json:"contributor_id"`
	Classification       string    `json:"classification"`
	ClassificationReason string    `json:"classification_reason"`
	QualityStatus        string    `json:"quality_status"`
	FreshnessStatus      string    `json:"freshness_status"`
	Lat                  float64   `json:"lat"`
	Lng                  float64   `json:"lng"`
	SpeedKMH             float64   `json:"speed_kmh"`
	Bearing              float64   `json:"bearing"`
	Accuracy             float64   `json:"accuracy"`
	RouteID              string    `json:"route_id,omitempty"`
	BusNumber            string    `json:"bus_number,omitempty"`
	CrowdLevel           int       `json:"crowd_level,omitempty"`
	HasMetadata          bool      `json:"has_metadata"`
	LastSeen             time.Time `json:"last_seen"`
}

// DevicesUpdate is a broadcast message containing all active device states.
type DevicesUpdate struct {
	Type            string       `json:"type"`
	SnapshotVersion int64        `json:"snapshot_version"`
	Devices         []DeviceInfo `json:"devices"`
	Counts          DeviceCounts `json:"counts"`
}

// DeviceCounts summarises how many devices fall into each classification bucket.
type DeviceCounts struct {
	Total        int `json:"total"`
	Noise        int `json:"noise"`
	Potential    int `json:"potential"`
	Cluster      int `json:"cluster"`
	Confirmed    int `json:"confirmed"`
	Active       int `json:"active"`
	Suspect      int `json:"suspect"`
	Disconnected int `json:"disconnected"`
}
