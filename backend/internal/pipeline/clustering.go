package pipeline

import (
	"crypto/sha256"
	"fmt"
	"sort"
	"time"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/spatial"
)

const (
	clusterEpsKM    = 0.05 // 50 meters
	clusterSpeedEps = 5.0  // 5 km/h difference tolerance
	clusterMinPts   = 1    // single device is a valid bus
)

// DeviceState holds the latest position for a contributing device.
type DeviceState struct {
	SessionID            string
	DeviceHash           string
	ContributorID        string
	AdminID              string
	RouteID              string
	Lat                  float64
	Lng                  float64
	SpeedKMH             float64
	Bearing              float64
	Accuracy             float64
	LastSeen             time.Time
	LastBatchSeq         int64
	CrowdLevel           int
	BusNumber            string
	Classification       string
	ClassificationReason string
	HasMetadata          bool
	QualityStatus        string
	FreshnessStatus      string
}

func (d DeviceState) contributorKey() string {
	if d.SessionID != "" {
		return d.SessionID
	}
	return d.DeviceHash
}

// ClusterVehicles groups co-moving devices on the same route into virtual vehicles.
// Only devices with a non-empty RouteID participate in clustering.
func ClusterVehicles(devices []DeviceState) []model.Vehicle {
	if len(devices) == 0 {
		return nil
	}

	// Group by route
	byRoute := make(map[string][]DeviceState)
	for _, d := range devices {
		if d.RouteID != "" {
			byRoute[d.RouteID] = append(byRoute[d.RouteID], d)
		}
	}

	var vehicles []model.Vehicle

	for routeID, routeDevices := range byRoute {
		if len(routeDevices) == 1 {
			// Single contributor — no clustering needed
			d := routeDevices[0]
			contributorKey := d.contributorKey()
			vehicles = append(vehicles, model.Vehicle{
				VirtualID:        virtualID(routeID, []string{contributorKey}),
				RouteID:          routeID,
				Lat:              d.Lat,
				Lng:              d.Lng,
				SpeedKMH:         d.SpeedKMH,
				Bearing:          d.Bearing,
				ContributorCount: 1,
				Confidence:       model.ConfidenceLow,
				LastUpdate:       d.LastSeen,
				CrowdLevel:       d.CrowdLevel,
				BusNumber:        d.BusNumber,
				Contributors:     []string{contributorKey},
			})
			continue
		}

		// Build DBSCAN points
		points := make([]spatial.DBSCANPoint, len(routeDevices))
		for i, d := range routeDevices {
			points[i] = spatial.DBSCANPoint{
				Lat:      d.Lat,
				Lng:      d.Lng,
				Speed:    d.SpeedKMH,
				Accuracy: d.Accuracy,
				ID:       d.contributorKey(),
			}
		}

		clusters := spatial.DBSCAN(points, clusterEpsKM, clusterSpeedEps, clusterMinPts)

		for _, cluster := range clusters {
			n := len(cluster.Points)

			// Weighted position fusion (weight by 1/accuracy — better GPS contributes more)
			var totalW, fusedLat, fusedLng, fusedSpeed float64
			deviceIDs := make([]string, n)

			for i, p := range cluster.Points {
				w := 1.0 / max(p.Accuracy, 1.0)
				totalW += w
				fusedLat += p.Lat * w
				fusedLng += p.Lng * w
				fusedSpeed += p.Speed * w
				deviceIDs[i] = p.ID
			}

			fusedLat /= totalW
			fusedLng /= totalW
			fusedSpeed /= totalW

			confidence := model.ConfidenceLow
			if n >= 3 {
				confidence = model.ConfidenceVerified
			} else if n >= 2 {
				confidence = model.ConfidenceGood
			}

			// Find most recent update time
			var latest time.Time
			var bestBearing float64
			for _, d := range routeDevices {
				for _, p := range cluster.Points {
					if d.contributorKey() == p.ID && d.LastSeen.After(latest) {
						latest = d.LastSeen
						bestBearing = d.Bearing
					}
				}
			}

			var crowdSum, crowdCount int
			var busNumber string
			for _, d := range routeDevices {
				for _, p := range cluster.Points {
					if d.contributorKey() == p.ID {
						if d.CrowdLevel > 0 {
							crowdSum += d.CrowdLevel
							crowdCount++
						}
						if d.BusNumber != "" && busNumber == "" {
							busNumber = d.BusNumber
						}
					}
				}
			}
			avgCrowd := 0
			if crowdCount > 0 {
				avgCrowd = (crowdSum + crowdCount/2) / crowdCount
			}

			vehicles = append(vehicles, model.Vehicle{
				VirtualID:        virtualID(routeID, deviceIDs),
				RouteID:          routeID,
				Lat:              fusedLat,
				Lng:              fusedLng,
				SpeedKMH:         fusedSpeed,
				Bearing:          bestBearing,
				ContributorCount: n,
				Confidence:       confidence,
				LastUpdate:       latest,
				CrowdLevel:       avgCrowd,
				BusNumber:        busNumber,
				Contributors:     deviceIDs,
			})
		}
	}

	return vehicles
}

func virtualID(routeID string, deviceIDs []string) string {
	sort.Strings(deviceIDs)
	h := sha256.New()
	h.Write([]byte(routeID))
	for _, id := range deviceIDs {
		h.Write([]byte(id))
	}
	return fmt.Sprintf("v_%s_%x", routeID, h.Sum(nil)[:4])
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
