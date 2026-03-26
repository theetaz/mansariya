package spatial

import (
	"sync"

	"github.com/paulmach/orb"
	"github.com/tidwall/rtree"
)

// RouteIndex provides fast spatial lookup of routes by bounding box.
// All route polylines are loaded into an R-tree at startup.
type RouteIndex struct {
	mu    sync.RWMutex
	tree  rtree.RTreeG[string] // maps bounding box → route ID
	lines map[string]orb.LineString
}

// NewRouteIndex creates an empty route index.
func NewRouteIndex() *RouteIndex {
	return &RouteIndex{
		lines: make(map[string]orb.LineString),
	}
}

// Load replaces the index with the given routes.
func (idx *RouteIndex) Load(routes map[string]orb.LineString) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	idx.tree = rtree.RTreeG[string]{}
	idx.lines = make(map[string]orb.LineString, len(routes))

	for id, line := range routes {
		if len(line) < 2 {
			continue
		}
		idx.lines[id] = line

		bound := line.Bound()
		idx.tree.Insert(
			[2]float64{bound.Min.Lon(), bound.Min.Lat()},
			[2]float64{bound.Max.Lon(), bound.Max.Lat()},
			id,
		)
	}
}

// Nearby returns route IDs whose bounding box intersects the given point ± buffer (in degrees).
func (idx *RouteIndex) Nearby(lat, lng, bufferDeg float64) []string {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	var results []string
	idx.tree.Search(
		[2]float64{lng - bufferDeg, lat - bufferDeg},
		[2]float64{lng + bufferDeg, lat + bufferDeg},
		func(min, max [2]float64, routeID string) bool {
			results = append(results, routeID)
			return true
		},
	)
	return results
}

// NearbyFromTrace returns route IDs whose bounding box intersects the trace's bounding box ± buffer.
func (idx *RouteIndex) NearbyFromTrace(trace orb.LineString, bufferDeg float64) []string {
	if len(trace) == 0 {
		return nil
	}

	bound := trace.Bound()
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	var results []string
	idx.tree.Search(
		[2]float64{bound.Min.Lon() - bufferDeg, bound.Min.Lat() - bufferDeg},
		[2]float64{bound.Max.Lon() + bufferDeg, bound.Max.Lat() + bufferDeg},
		func(min, max [2]float64, routeID string) bool {
			results = append(results, routeID)
			return true
		},
	)
	return results
}

// GetPolyline returns the polyline for a given route ID.
func (idx *RouteIndex) GetPolyline(routeID string) (orb.LineString, bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	line, ok := idx.lines[routeID]
	return line, ok
}

// Count returns the number of routes in the index.
func (idx *RouteIndex) Count() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return len(idx.lines)
}
