package service

import (
	"context"
	"fmt"
	"math"

	"github.com/masariya/backend/internal/model"
	"github.com/masariya/backend/internal/spatial"
	"github.com/paulmach/orb"
	"github.com/redis/go-redis/v9"
)

// ETAService computes estimated arrival times for buses on a route.
type ETAService struct {
	rdb        *redis.Client
	routeIndex *spatial.RouteIndex
}

func NewETAService(rdb *redis.Client, routeIndex *spatial.RouteIndex) *ETAService {
	return &ETAService{rdb: rdb, routeIndex: routeIndex}
}

// Calculate returns ETAs for all active buses arriving at a given stop on a route.
func (s *ETAService) Calculate(ctx context.Context, routeID string, stopLat, stopLng float64) (*model.ETAResponse, error) {
	// Get active buses on this route from Redis sorted set
	busIDs, err := s.rdb.ZRangeByScore(ctx, "route:"+routeID+":buses", &redis.ZRangeBy{
		Min: "-inf",
		Max: "+inf",
	}).Result()
	if err != nil {
		return nil, fmt.Errorf("get active buses: %w", err)
	}

	resp := &model.ETAResponse{
		RouteID: routeID,
		StopID:  fmt.Sprintf("%.4f,%.4f", stopLat, stopLng),
		Buses:   []model.BusETA{},
	}

	routeLine, hasRoute := s.routeIndex.GetPolyline(routeID)

	for _, busID := range busIDs {
		pos, err := s.rdb.HGetAll(ctx, "bus:"+busID+":pos").Result()
		if err != nil || len(pos) == 0 {
			continue
		}

		var busLat, busLng, speed float64
		var confidence string
		var contributors int

		fmt.Sscanf(pos["lat"], "%f", &busLat)
		fmt.Sscanf(pos["lng"], "%f", &busLng)
		fmt.Sscanf(pos["speed"], "%f", &speed)
		confidence = pos["confidence"]
		fmt.Sscanf(pos["count"], "%d", &contributors)

		// Calculate distance to stop
		var distanceKM float64
		if hasRoute && len(routeLine) >= 2 {
			distanceKM = distanceAlongRoute(routeLine, busLat, busLng, stopLat, stopLng)
		} else {
			distanceKM = spatial.Haversine(busLat, busLng, stopLat, stopLng)
		}

		// Calculate ETA
		if speed <= 0 {
			speed = 25 // default 25 km/h if stationary
		}
		etaMinutes := (distanceKM / speed) * 60

		if etaMinutes < 0 {
			continue // bus has passed the stop
		}

		resp.Buses = append(resp.Buses, model.BusETA{
			BusID:            busID,
			ETAMinutes:       int(math.Round(etaMinutes)),
			Confidence:       confidence,
			DistanceKM:       math.Round(distanceKM*10) / 10,
			ContributorCount: contributors,
		})
	}

	return resp, nil
}

// distanceAlongRoute computes the route distance from bus position to stop position,
// by projecting both onto the route polyline and measuring along it.
func distanceAlongRoute(route orb.LineString, busLat, busLng, stopLat, stopLng float64) float64 {
	busIdx := nearestSegmentIndex(route, busLat, busLng)
	stopIdx := nearestSegmentIndex(route, stopLat, stopLng)

	if stopIdx <= busIdx {
		// Stop is behind the bus (already passed)
		return -1
	}

	// Sum segment distances from bus position to stop position
	totalKM := 0.0

	// Distance from bus to end of its segment
	if busIdx < len(route)-1 {
		totalKM += spatial.Haversine(busLat, busLng, route[busIdx+1].Lat(), route[busIdx+1].Lon())
	}

	// Full segments between
	for i := busIdx + 1; i < stopIdx && i < len(route)-1; i++ {
		totalKM += spatial.Haversine(route[i].Lat(), route[i].Lon(), route[i+1].Lat(), route[i+1].Lon())
	}

	// Distance from start of stop's segment to stop
	if stopIdx < len(route) {
		totalKM += spatial.Haversine(route[stopIdx].Lat(), route[stopIdx].Lon(), stopLat, stopLng)
	}

	return totalKM
}

// nearestSegmentIndex finds the route segment index closest to a point.
func nearestSegmentIndex(route orb.LineString, lat, lng float64) int {
	minDist := math.MaxFloat64
	bestIdx := 0

	for i := 0; i < len(route); i++ {
		d := spatial.Haversine(lat, lng, route[i].Lat(), route[i].Lon())
		if d < minDist {
			minDist = d
			bestIdx = i
		}
	}
	return bestIdx
}
