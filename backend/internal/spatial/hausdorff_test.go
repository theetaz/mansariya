package spatial

import (
	"testing"

	"github.com/paulmach/orb"
	"github.com/stretchr/testify/assert"
)

func TestHausdorff_IdenticalLines(t *testing.T) {
	line := orb.LineString{
		{79.86, 6.92}, {79.87, 6.93}, {79.88, 6.94},
	}
	got := Hausdorff(line, line)
	assert.InDelta(t, 0.0, got, 0.0001, "Identical lines should have zero Hausdorff distance")
}

func TestHausdorff_ParallelLines(t *testing.T) {
	a := orb.LineString{
		{79.86, 6.92}, {79.87, 6.93}, {79.88, 6.94},
	}
	// Offset ~0.001 degrees (~100m)
	b := orb.LineString{
		{79.861, 6.92}, {79.871, 6.93}, {79.881, 6.94},
	}
	got := Hausdorff(a, b)
	assert.Greater(t, got, 0.0, "Parallel offset lines should have non-zero distance")
	assert.Less(t, got, 0.01, "Offset should be small (~0.001 degrees)")
}

func TestHausdorff_DisjointLines(t *testing.T) {
	a := orb.LineString{
		{79.86, 6.92}, {79.87, 6.93},
	}
	// Far away line (Kandy area)
	b := orb.LineString{
		{80.63, 7.29}, {80.64, 7.30},
	}
	got := Hausdorff(a, b)
	assert.Greater(t, got, 0.5, "Distant lines should have large Hausdorff distance")
}

func TestHausdorff_Symmetry(t *testing.T) {
	a := orb.LineString{
		{79.86, 6.92}, {79.87, 6.93}, {79.88, 6.94},
	}
	b := orb.LineString{
		{79.861, 6.921}, {79.871, 6.931},
	}
	h1 := Hausdorff(a, b)
	h2 := Hausdorff(b, a)
	assert.InDelta(t, h1, h2, 0.0001, "Hausdorff distance should be symmetric")
}

func TestHausdorff_SinglePoint(t *testing.T) {
	// Edge case: single-point "line"
	a := orb.LineString{{79.86, 6.92}}
	b := orb.LineString{{79.87, 6.93}, {79.88, 6.94}}
	got := Hausdorff(a, b)
	assert.Greater(t, got, 0.0, "Single point vs line should have non-zero distance")
}

func TestCoverage_FullOverlap(t *testing.T) {
	line := orb.LineString{
		{79.86, 6.92}, {79.87, 6.93}, {79.88, 6.94},
	}
	got := Coverage(line, line, 0.0003)
	assert.InDelta(t, 1.0, got, 0.01, "Identical lines should have 100%% coverage")
}

func TestCoverage_NoOverlap(t *testing.T) {
	a := orb.LineString{
		{79.86, 6.92}, {79.87, 6.93},
	}
	// Far away
	b := orb.LineString{
		{80.63, 7.29}, {80.64, 7.30},
	}
	got := Coverage(a, b, 0.0003)
	assert.InDelta(t, 0.0, got, 0.01, "Disjoint lines should have 0%% coverage")
}

func TestCoverage_PartialOverlap(t *testing.T) {
	// A extends beyond B
	a := orb.LineString{
		{79.86, 6.92}, {79.87, 6.93}, {79.88, 6.94}, {79.89, 6.95},
	}
	// B covers only the first half
	b := orb.LineString{
		{79.86, 6.92}, {79.87, 6.93},
	}
	got := Coverage(a, b, 0.0003)
	assert.Greater(t, got, 0.1, "Should have some coverage")
	assert.Less(t, got, 0.9, "Should not have full coverage")
}

func TestCoverage_EmptyLine(t *testing.T) {
	a := orb.LineString{}
	b := orb.LineString{{79.86, 6.92}, {79.87, 6.93}}
	got := Coverage(a, b, 0.0003)
	assert.Equal(t, 0.0, got, "Empty line should have 0 coverage")
}

func TestCoverage_SingleSegment(t *testing.T) {
	a := orb.LineString{{79.86, 6.92}} // only 1 point
	b := orb.LineString{{79.86, 6.92}, {79.87, 6.93}}
	got := Coverage(a, b, 0.0003)
	assert.Equal(t, 0.0, got, "Single-point line has no segments")
}
