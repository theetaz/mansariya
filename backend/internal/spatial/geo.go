package spatial

import "math"

const earthRadiusKM = 6371.0

// Haversine returns the great-circle distance in km between two lat/lng points.
func Haversine(lat1, lng1, lat2, lng2 float64) float64 {
	dLat := toRad(lat2 - lat1)
	dLng := toRad(lng2 - lng1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*
			math.Sin(dLng/2)*math.Sin(dLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKM * c
}

// Bearing returns the initial bearing in degrees from point 1 to point 2.
func Bearing(lat1, lng1, lat2, lng2 float64) float64 {
	dLng := toRad(lng2 - lng1)
	lat1R := toRad(lat1)
	lat2R := toRad(lat2)

	y := math.Sin(dLng) * math.Cos(lat2R)
	x := math.Cos(lat1R)*math.Sin(lat2R) - math.Sin(lat1R)*math.Cos(lat2R)*math.Cos(dLng)

	bearing := toDeg(math.Atan2(y, x))
	return math.Mod(bearing+360, 360)
}

// PointToSegmentDistance returns the minimum distance in km from a point to a line segment.
func PointToSegmentDistance(pLat, pLng, aLat, aLng, bLat, bLng float64) float64 {
	ab := Haversine(aLat, aLng, bLat, bLng)
	if ab == 0 {
		return Haversine(pLat, pLng, aLat, aLng)
	}

	// Project point onto line segment using dot product approximation
	ap := Haversine(aLat, aLng, pLat, pLng)
	bp := Haversine(bLat, bLng, pLat, pLng)

	// If projection falls outside segment, return distance to nearest endpoint
	if ap*ap+ab*ab < bp*bp {
		return ap
	}
	if bp*bp+ab*ab < ap*ap {
		return bp
	}

	// Use the triangle area method for perpendicular distance
	s := (ap + bp + ab) / 2
	area := math.Sqrt(math.Max(0, s*(s-ap)*(s-bp)*(s-ab)))
	return 2 * area / ab
}

// BearingDifference returns the absolute angular difference between two bearings (0-180).
func BearingDifference(b1, b2 float64) float64 {
	diff := math.Abs(b1 - b2)
	if diff > 180 {
		diff = 360 - diff
	}
	return diff
}

func toRad(deg float64) float64 { return deg * math.Pi / 180 }
func toDeg(rad float64) float64 { return rad * 180 / math.Pi }
