package pipeline

import (
	"testing"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/stretchr/testify/assert"
)

func TestClassify_Noise_SlowNoMetadata(t *testing.T) {
	d := &DeviceState{
		DeviceHash:  "test_slow",
		Lat:         6.9271,
		Lng:         79.8612,
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
		Lat:         6.9271,
		Lng:         79.8612,
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
		Lat:         6.9271,
		Lng:         79.8612,
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
		Lat:         6.9271,
		Lng:         79.8612,
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
		Lat:         6.9271,
		Lng:         79.8612,
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
		Lat:         6.9271,
		Lng:         79.8612,
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

func TestClassify_Noise_WhenOutsideServiceRegion(t *testing.T) {
	d := &DeviceState{
		DeviceHash: "test_out_of_region",
		Lat:        52.52,
		Lng:        13.405,
		SpeedKMH:   20,
		LastSeen:   time.Now(),
	}

	Classify(d)

	assert.Equal(t, model.ClassificationNoise, d.Classification)
	assert.Equal(t, model.QualityOutOfRegion, d.QualityStatus)
	assert.Contains(t, d.ClassificationReason, "outside Sri Lanka")
}
