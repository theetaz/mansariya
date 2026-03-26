package spatial

import (
	"math"

	"github.com/paulmach/orb"
)

// Hausdorff computes the symmetric Hausdorff distance between two LineStrings in degrees.
// This measures how far the two curves are from each other.
func Hausdorff(a, b orb.LineString) float64 {
	return math.Max(DirectedHausdorff(a, b), DirectedHausdorff(b, a))
}

// DirectedHausdorff computes max(min distance from each point in a to any segment in b).
// Use this when a is a trace (subset) and b is a route (full line) — it measures
// how far the trace deviates from the route, ignoring uncovered route portions.
func DirectedHausdorff(a, b orb.LineString) float64 {
	maxDist := 0.0
	for _, pa := range a {
		minDist := math.MaxFloat64
		for i := 0; i < len(b)-1; i++ {
			d := pointToSegmentDegrees(pa, b[i], b[i+1])
			if d < minDist {
				minDist = d
			}
		}
		if minDist > maxDist {
			maxDist = minDist
		}
	}
	return maxDist
}

// Coverage returns the fraction of line A that falls within a buffer distance of line B.
// bufferDeg is the buffer in degrees (~0.0003 ≈ 30m at equator).
func Coverage(a, b orb.LineString, bufferDeg float64) float64 {
	if len(a) < 2 {
		return 0
	}

	totalLen := 0.0
	coveredLen := 0.0

	for i := 0; i < len(a)-1; i++ {
		segLen := pointDistDegrees(a[i], a[i+1])
		totalLen += segLen

		// Check if midpoint of this segment is within buffer of line B
		mid := orb.Point{
			(a[i][0] + a[i+1][0]) / 2,
			(a[i][1] + a[i+1][1]) / 2,
		}
		minDist := minDistToLine(mid, b)
		if minDist <= bufferDeg {
			coveredLen += segLen
		}
	}

	if totalLen == 0 {
		return 0
	}
	return coveredLen / totalLen
}

func minDistToLine(p orb.Point, line orb.LineString) float64 {
	minDist := math.MaxFloat64
	for i := 0; i < len(line)-1; i++ {
		d := pointToSegmentDegrees(p, line[i], line[i+1])
		if d < minDist {
			minDist = d
		}
	}
	return minDist
}

// pointToSegmentDegrees returns the distance from point p to segment a-b in degrees.
func pointToSegmentDegrees(p, a, b orb.Point) float64 {
	dx := b[0] - a[0]
	dy := b[1] - a[1]
	lenSq := dx*dx + dy*dy

	if lenSq == 0 {
		return pointDistDegrees(p, a)
	}

	t := ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / lenSq
	t = math.Max(0, math.Min(1, t))

	proj := orb.Point{a[0] + t*dx, a[1] + t*dy}
	return pointDistDegrees(p, proj)
}

func pointDistDegrees(a, b orb.Point) float64 {
	dx := a[0] - b[0]
	dy := a[1] - b[1]
	return math.Sqrt(dx*dx + dy*dy)
}
