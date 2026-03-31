package pipeline

import "fmt"

const (
	speedMinBus = 5.0  // km/h — below this is likely walking
	speedMaxBus = 80.0 // km/h — above this is likely a car/train
)

// Classify sets the Classification and ClassificationReason on a DeviceState.
// Priority: confirmed > cluster > potential > noise.
// Cluster classification is set externally by ClusterVehicles — this function
// handles noise, potential, and confirmed.
func Classify(d *DeviceState) {
	d.HasMetadata = d.RouteID != "" || d.BusNumber != "" || d.CrowdLevel > 0

	// Confirmed: has route + bus number (full metadata)
	if d.RouteID != "" && d.BusNumber != "" {
		d.Classification = "confirmed"
		d.ClassificationReason = "full metadata (route + bus number)"
		return
	}

	// Potential: has any metadata regardless of speed
	if d.HasMetadata {
		d.Classification = "potential"
		d.ClassificationReason = fmt.Sprintf("has metadata (route=%q, bus=%q, crowd=%d)",
			d.RouteID, d.BusNumber, d.CrowdLevel)
		return
	}

	// Potential: moderate speed range (bus-like)
	if d.SpeedKMH >= speedMinBus && d.SpeedKMH <= speedMaxBus {
		d.Classification = "potential"
		d.ClassificationReason = fmt.Sprintf("speed %.1f km/h (bus range 5-80)", d.SpeedKMH)
		return
	}

	// Noise: everything else
	d.Classification = "noise"
	d.ClassificationReason = fmt.Sprintf("speed %.1f km/h, no metadata", d.SpeedKMH)
}
