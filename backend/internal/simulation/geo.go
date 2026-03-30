package simulation

import (
	"math"
	"math/rand"
)

const earthRadiusKM = 6371.0

func haversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	dLat := toRad(lat2 - lat1)
	dLng := toRad(lng2 - lng1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKM * c * 1000
}

func toRad(deg float64) float64 { return deg * math.Pi / 180 }
func toDeg(rad float64) float64 { return rad * 180 / math.Pi }

func bearing(lat1, lng1, lat2, lng2 float64) float64 {
	dLng := toRad(lng2 - lng1)
	y := math.Sin(dLng) * math.Cos(toRad(lat2))
	x := math.Cos(toRad(lat1))*math.Sin(toRad(lat2)) -
		math.Sin(toRad(lat1))*math.Cos(toRad(lat2))*math.Cos(dLng)
	brg := toDeg(math.Atan2(y, x))
	return math.Mod(brg+360, 360)
}

// polyline is [][2]float64 where [0]=lng, [1]=lat (GeoJSON convention).
func polylineSegmentDistances(polyline [][2]float64) []float64 {
	dists := make([]float64, len(polyline))
	dists[0] = 0
	for i := 1; i < len(polyline); i++ {
		d := haversineDistance(polyline[i-1][1], polyline[i-1][0], polyline[i][1], polyline[i][0])
		dists[i] = dists[i-1] + d
	}
	return dists
}

func interpolatePosition(polyline [][2]float64, cumDists []float64, distanceMeters float64) (lat, lng, brg float64) {
	totalDist := cumDists[len(cumDists)-1]
	if distanceMeters >= totalDist {
		last := polyline[len(polyline)-1]
		prev := polyline[len(polyline)-2]
		return last[1], last[0], bearing(prev[1], prev[0], last[1], last[0])
	}
	if distanceMeters <= 0 {
		first := polyline[0]
		second := polyline[1]
		return first[1], first[0], bearing(first[1], first[0], second[1], second[0])
	}

	segIdx := 0
	for i := 1; i < len(cumDists); i++ {
		if cumDists[i] >= distanceMeters {
			segIdx = i - 1
			break
		}
	}

	segLen := cumDists[segIdx+1] - cumDists[segIdx]
	if segLen == 0 {
		pt := polyline[segIdx]
		return pt[1], pt[0], 0
	}

	fraction := (distanceMeters - cumDists[segIdx]) / segLen
	p1 := polyline[segIdx]
	p2 := polyline[segIdx+1]

	lat = p1[1] + fraction*(p2[1]-p1[1])
	lng = p1[0] + fraction*(p2[0]-p1[0])
	brg = bearing(p1[1], p1[0], p2[1], p2[0])
	return lat, lng, brg
}

func findNearestDistanceOnPolyline(polyline [][2]float64, cumDists []float64, lat, lng float64) float64 {
	minDist := math.MaxFloat64
	bestAlong := 0.0
	for i := 0; i < len(polyline); i++ {
		d := haversineDistance(lat, lng, polyline[i][1], polyline[i][0])
		if d < minDist {
			minDist = d
			bestAlong = cumDists[i]
		}
	}
	return bestAlong
}

func addGPSNoise(lat, lng, speedMS, brg float64, rng *rand.Rand) (nLat, nLng float64, nAcc, nSpd, nBrg float64) {
	// Position noise: ±5-10m (~0.00005 to 0.0001 degrees)
	latNoise := (rng.Float64()*0.00005 + 0.00005) * randomSign(rng)
	lngNoise := (rng.Float64()*0.00005 + 0.00005) * randomSign(rng)
	nLat = lat + latNoise
	nLng = lng + lngNoise
	// Accuracy: 5-15m
	nAcc = 5 + rng.Float64()*10
	// Speed noise: ±0.2-0.5 m/s (~±0.7-1.8 km/h) — keep within DBSCAN speed eps of 5 km/h
	nSpd = speedMS + (rng.Float64()*0.3+0.2)*randomSign(rng)
	if nSpd < 0 {
		nSpd = 0
	}
	// Bearing noise: ±1-3 degrees
	nBrg = brg + (rng.Float64()*2+1)*randomSign(rng)
	nBrg = math.Mod(nBrg+360, 360)
	return nLat, nLng, nAcc, nSpd, nBrg
}

func randomSign(rng *rand.Rand) float64 {
	if rng.Intn(2) == 0 {
		return -1
	}
	return 1
}
