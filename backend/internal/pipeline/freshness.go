package pipeline

import (
	"time"

	"github.com/masariya/backend/internal/model"
)

const (
	activeWindow       = 15 * time.Second
	suspectWindow      = 30 * time.Second
	deviceExpiryWindow = 2 * time.Minute
)

func freshnessStatus(lastSeen, now time.Time) string {
	age := now.Sub(lastSeen)
	if age <= activeWindow {
		return model.FreshnessActive
	}
	if age <= suspectWindow {
		return model.FreshnessSuspect
	}
	return model.FreshnessDisconnected
}

func isClusterEligible(lastSeen, now time.Time) bool {
	return now.Sub(lastSeen) <= activeWindow
}

func isExpired(lastSeen, now time.Time) bool {
	return now.Sub(lastSeen) > deviceExpiryWindow
}
