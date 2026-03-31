package pipeline

import (
	"testing"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFreshnessStatus_Active(t *testing.T) {
	now := time.Now()
	status := freshnessStatus(now.Add(-10*time.Second), now)
	assert.Equal(t, model.FreshnessActive, status)
}

func TestFreshnessStatus_Suspect(t *testing.T) {
	now := time.Now()
	status := freshnessStatus(now.Add(-20*time.Second), now)
	assert.Equal(t, model.FreshnessSuspect, status)
}

func TestFreshnessStatus_Disconnected(t *testing.T) {
	now := time.Now()
	status := freshnessStatus(now.Add(-45*time.Second), now)
	assert.Equal(t, model.FreshnessDisconnected, status)
}

func TestDevicesUpdate_IncludesFreshnessCounts(t *testing.T) {
	now := time.Now()
	devices := []DeviceState{
		{SessionID: "sess_active", AdminID: "c_active", Classification: model.ClassificationPotential, QualityStatus: model.QualityOK, LastSeen: now.Add(-5 * time.Second)},
		{SessionID: "sess_suspect", AdminID: "c_suspect", Classification: model.ClassificationNoise, QualityStatus: model.QualityOutOfRegion, LastSeen: now.Add(-20 * time.Second)},
		{SessionID: "sess_disconnected", AdminID: "c_disconnected", Classification: model.ClassificationConfirmed, QualityStatus: model.QualityOK, LastSeen: now.Add(-40 * time.Second)},
	}

	update := devicesUpdate(devices)

	require.Len(t, update.Devices, 3)
	assert.Equal(t, 1, update.Counts.Active)
	assert.Equal(t, 1, update.Counts.Suspect)
	assert.Equal(t, 1, update.Counts.Disconnected)
	assert.Equal(t, 1, update.Counts.Noise)
	assert.Equal(t, 1, update.Counts.Potential)
	assert.Equal(t, 1, update.Counts.Confirmed)
	assert.Equal(t, model.FreshnessActive, update.Devices[0].FreshnessStatus)
}
