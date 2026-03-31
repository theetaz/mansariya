package pipeline

import (
	"fmt"

	"github.com/masariya/backend/internal/model"
)

const (
	speedMinBus    = 5.0  // km/h — below this is likely walking
	speedMaxBus    = 80.0 // km/h — above this is likely a car/train
	sriLankaMinLat = 5.7
	sriLankaMaxLat = 10.1
	sriLankaMinLng = 79.4
	sriLankaMaxLng = 82.1
)

// Classify sets the Classification and ClassificationReason on a DeviceState.
// Priority: confirmed > cluster > potential > noise.
// Cluster classification is set externally by ClusterVehicles — this function
// handles noise, potential, and confirmed.
func Classify(d *DeviceState) {
	d.HasMetadata = d.RouteID != "" || d.BusNumber != "" || d.CrowdLevel > 0
	d.QualityStatus = model.QualityOK

	if d.Accuracy > 100 {
		d.QualityStatus = model.QualityLowAccuracy
	}

	if d.Lat < sriLankaMinLat || d.Lat > sriLankaMaxLat || d.Lng < sriLankaMinLng || d.Lng > sriLankaMaxLng {
		d.QualityStatus = model.QualityOutOfRegion
		d.Classification = model.ClassificationNoise
		d.ClassificationReason = fmt.Sprintf("outside Sri Lanka service region (%.4f, %.4f)", d.Lat, d.Lng)
		return
	}

	// Confirmed: has route + bus number (full metadata)
	if d.RouteID != "" && d.BusNumber != "" {
		d.Classification = model.ClassificationConfirmed
		d.ClassificationReason = "full metadata (route + bus number)"
		return
	}

	// Potential: has any metadata regardless of speed
	if d.HasMetadata {
		d.Classification = model.ClassificationPotential
		d.ClassificationReason = fmt.Sprintf("has metadata (route=%q, bus=%q, crowd=%d)",
			d.RouteID, d.BusNumber, d.CrowdLevel)
		return
	}

	// Potential: moderate speed range (bus-like)
	if d.SpeedKMH >= speedMinBus && d.SpeedKMH <= speedMaxBus {
		d.Classification = model.ClassificationPotential
		d.ClassificationReason = fmt.Sprintf("speed %.1f km/h (bus range 5-80)", d.SpeedKMH)
		return
	}

	// Noise: everything else
	d.Classification = model.ClassificationNoise
	d.ClassificationReason = fmt.Sprintf("speed %.1f km/h, no metadata", d.SpeedKMH)
}
