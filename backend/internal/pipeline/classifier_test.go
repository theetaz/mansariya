package pipeline

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestClassify_Noise_SlowNoMetadata(t *testing.T) {
	d := &DeviceState{
		DeviceHash:  "test_slow",
		SpeedKMH:    2.0,
		RouteID:     "",
		BusNumber:   "",
		CrowdLevel:  0,
		HasMetadata: false,
		LastSeen:    time.Now(),
	}
	Classify(d)
	assert.Equal(t, "noise", d.Classification)
	assert.Contains(t, d.ClassificationReason, "speed")
}

func TestClassify_Potential_ModerateSpeed(t *testing.T) {
	d := &DeviceState{
		DeviceHash:  "test_moderate",
		SpeedKMH:    25.0,
		RouteID:     "",
		BusNumber:   "",
		CrowdLevel:  0,
		HasMetadata: false,
		LastSeen:    time.Now(),
	}
	Classify(d)
	assert.Equal(t, "potential", d.Classification)
	assert.Contains(t, d.ClassificationReason, "speed")
}

func TestClassify_Potential_HasMetadata_SlowSpeed(t *testing.T) {
	d := &DeviceState{
		DeviceHash:  "test_meta_slow",
		SpeedKMH:    3.0,
		RouteID:     "R001",
		BusNumber:   "",
		CrowdLevel:  0,
		HasMetadata: true,
		LastSeen:    time.Now(),
	}
	Classify(d)
	assert.Equal(t, "potential", d.Classification)
	assert.Contains(t, d.ClassificationReason, "metadata")
}

func TestClassify_Confirmed_HasRouteAndBusNumber(t *testing.T) {
	d := &DeviceState{
		DeviceHash:  "test_confirmed",
		SpeedKMH:    30.0,
		RouteID:     "R001",
		BusNumber:   "NB-1234",
		CrowdLevel:  2,
		HasMetadata: true,
		LastSeen:    time.Now(),
	}
	Classify(d)
	assert.Equal(t, "confirmed", d.Classification)
	assert.Contains(t, d.ClassificationReason, "full metadata")
}

func TestClassify_Noise_VeryHighSpeed(t *testing.T) {
	d := &DeviceState{
		DeviceHash:  "test_fast",
		SpeedKMH:    120.0,
		RouteID:     "",
		BusNumber:   "",
		CrowdLevel:  0,
		HasMetadata: false,
		LastSeen:    time.Now(),
	}
	Classify(d)
	assert.Equal(t, "noise", d.Classification)
	assert.Contains(t, d.ClassificationReason, "speed")
}

func TestClassify_Potential_HasCrowdLevel(t *testing.T) {
	d := &DeviceState{
		DeviceHash:  "test_crowd",
		SpeedKMH:    3.0,
		RouteID:     "",
		BusNumber:   "",
		CrowdLevel:  2,
		HasMetadata: true,
		LastSeen:    time.Now(),
	}
	Classify(d)
	assert.Equal(t, "potential", d.Classification)
}
