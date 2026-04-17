package model

import "time"

// Contributor statuses
const (
	ContributorStatusAnonymous = "anonymous"
	ContributorStatusClaimed   = "claimed"
	ContributorStatusDisabled  = "disabled"
)

type Contributor struct {
	ID            string     `json:"id"`
	ContributorID string     `json:"contributor_id"`
	DisplayName   *string    `json:"display_name,omitempty"`
	PasswordHash  string     `json:"-"`
	Status        string     `json:"status"`
	ClaimedAt     *time.Time `json:"claimed_at,omitempty"`
	LastSeenAt    *time.Time `json:"last_seen_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type ContributionStats struct {
	ContributorID       string     `json:"contributor_id"`
	TotalTrips          int        `json:"total_trips"`
	TotalPings          int64      `json:"total_pings"`
	TotalDistanceKM     float64    `json:"total_distance_km"`
	QualityScore        float64    `json:"quality_score"`
	NoiseCount          int        `json:"noise_count"`
	PotentialCount      int        `json:"potential_count"`
	ClusterCount        int        `json:"cluster_count"`
	ConfirmedCount      int        `json:"confirmed_count"`
	RoutesContributed   int        `json:"routes_contributed"`
	StopsDiscovered     int        `json:"stops_discovered"`
	ActiveDays          int        `json:"active_days"`
	FirstContributionAt *time.Time `json:"first_contribution_at,omitempty"`
	LastContributionAt  *time.Time `json:"last_contribution_at,omitempty"`
}

type LeaderboardEntry struct {
	Rank            int     `json:"rank"`
	ContributorID   string  `json:"contributor_id"`
	DisplayName     *string `json:"display_name,omitempty"`
	TotalTrips      int     `json:"total_trips"`
	TotalPings      int64   `json:"total_pings"`
	TotalDistanceKM float64 `json:"total_distance_km"`
	QualityScore    float64 `json:"quality_score"`
	ActiveDays      int     `json:"active_days"`
}

type ContributorSession struct {
	ID            string    `json:"id"`
	ContributorID string    `json:"contributor_id"`
	TokenHash     string    `json:"-"`
	IPAddress     string    `json:"ip_address,omitempty"`
	UserAgent     string    `json:"user_agent,omitempty"`
	ExpiresAt     time.Time `json:"expires_at"`
	CreatedAt     time.Time `json:"created_at"`
	LastUsedAt    time.Time `json:"last_used_at"`
}
