package pipeline

import (
	"context"
	"testing"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBroadcaster_PersistsAndLoadsDeviceSnapshot(t *testing.T) {
	rdb := skipIfNoRedis(t)
	defer rdb.Close()

	ctx := context.Background()
	require.NoError(t, rdb.Del(ctx, devicesSnapshotKey, devicesActiveKey, deviceStateKey("sess_1")).Err())

	b := NewBroadcaster(rdb)
	device := DeviceState{
		SessionID:       "sess_1",
		AdminID:         "c_123",
		Classification:  model.ClassificationPotential,
		QualityStatus:   model.QualityOK,
		FreshnessStatus: model.FreshnessActive,
		LastSeen:        time.Now(),
	}

	require.NoError(t, b.UpsertDeviceState(ctx, device))
	loaded, err := b.LoadActiveDeviceStates(ctx)
	require.NoError(t, err)
	require.Len(t, loaded, 1)
	assert.Equal(t, "sess_1", loaded[0].SessionID)

	b.PublishAllDevices(ctx, loaded)
	snapshot, err := b.CurrentDevicesSnapshot(ctx)
	require.NoError(t, err)
	require.Len(t, snapshot.Devices, 1)
	assert.Equal(t, "c_123", snapshot.Devices[0].ContributorID)
	assert.Equal(t, model.FreshnessActive, snapshot.Devices[0].FreshnessStatus)
	assert.Equal(t, 1, snapshot.Counts.Active)

	require.NoError(t, b.RemoveDeviceState(ctx, "sess_1"))
}
