package spatial

// DBSCAN implements density-based spatial clustering for co-moving device grouping.
// Optimized for the bus tracking use case: small input sizes (typically <100 points per route).

// DBSCANPoint represents a point to be clustered.
type DBSCANPoint struct {
	Lat      float64
	Lng      float64
	Speed    float64
	Accuracy float64
	ID       string // device_hash or identifier
}

// Cluster is a group of co-located, co-moving points (one bus).
type Cluster struct {
	Points []DBSCANPoint
	Label  int
}

// DBSCAN clusters points where distance between neighbors < eps (in km)
// and speed difference < speedEps (in km/h). minPts is minimum cluster size.
func DBSCAN(points []DBSCANPoint, epsKM float64, speedEpsKMH float64, minPts int) []Cluster {
	n := len(points)
	if n == 0 {
		return nil
	}

	labels := make([]int, n)   // 0 = unvisited, -1 = noise, >0 = cluster ID
	clusterID := 0

	for i := 0; i < n; i++ {
		if labels[i] != 0 {
			continue
		}

		neighbors := regionQuery(points, i, epsKM, speedEpsKMH)

		if len(neighbors) < minPts {
			labels[i] = -1 // noise
			continue
		}

		clusterID++
		labels[i] = clusterID

		// Expand cluster
		queue := make([]int, len(neighbors))
		copy(queue, neighbors)

		for len(queue) > 0 {
			j := queue[0]
			queue = queue[1:]

			if labels[j] == -1 {
				labels[j] = clusterID // noise becomes border point
			}
			if labels[j] != 0 {
				continue
			}

			labels[j] = clusterID
			jNeighbors := regionQuery(points, j, epsKM, speedEpsKMH)
			if len(jNeighbors) >= minPts {
				queue = append(queue, jNeighbors...)
			}
		}
	}

	// For bus tracking: treat noise points as single-device clusters
	// (a lone passenger is still a valid bus position)
	clusters := make(map[int][]DBSCANPoint)
	for i, label := range labels {
		if label == -1 {
			// Assign noise to its own cluster
			clusterID++
			clusters[clusterID] = []DBSCANPoint{points[i]}
		} else {
			clusters[label] = append(clusters[label], points[i])
		}
	}

	result := make([]Cluster, 0, len(clusters))
	for label, pts := range clusters {
		result = append(result, Cluster{Points: pts, Label: label})
	}
	return result
}

func regionQuery(points []DBSCANPoint, idx int, epsKM, speedEpsKMH float64) []int {
	var neighbors []int
	p := points[idx]

	for i, q := range points {
		if i == idx {
			continue
		}
		dist := Haversine(p.Lat, p.Lng, q.Lat, q.Lng)
		speedDiff := abs(p.Speed - q.Speed)

		if dist <= epsKM && speedDiff <= speedEpsKMH {
			neighbors = append(neighbors, i)
		}
	}
	return neighbors
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
