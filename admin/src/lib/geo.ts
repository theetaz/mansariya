export interface OSRMRoute {
  distance: number
  duration: number
  geometry: {
    type: "LineString"
    coordinates: [number, number][]
  }
  legs: {
    distance: number
    duration: number
    summary: string
    steps: {
      name: string
      distance: number
      duration: number
      maneuver: { type: string; location: [number, number] }
    }[]
  }[]
}

export interface OSRMResponse {
  code: string
  routes: OSRMRoute[]
  waypoints: { name: string; location: [number, number] }[]
}

export async function getRoute(
  start: [number, number],
  end: [number, number],
  waypoints?: [number, number][]
): Promise<OSRMResponse | null> {
  const coords = [start, ...(waypoints ?? []), end]
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(";")

  const res = await fetch(
    `/osrm/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`
  )
  if (!res.ok) return null
  return res.json()
}
