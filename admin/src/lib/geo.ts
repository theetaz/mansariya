// Nominatim geocoding (forward: name → coordinates)
export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
  address?: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export async function geocodeSearch(query: string, limit = 5): Promise<NominatimResult[]> {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({
    q: `${query}, Sri Lanka`,
    format: 'json',
    countrycodes: 'lk',
    limit: String(limit),
    addressdetails: '1',
  });
  const res = await fetch(`/nominatim/search?${params}`);
  if (!res.ok) return [];
  return res.json();
}

// OSRM routing (coordinates → road geometry)
export interface OSRMRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat]
  };
  legs: {
    distance: number;
    duration: number;
    summary: string;
    steps: {
      name: string;
      distance: number;
      duration: number;
      maneuver: { type: string; location: [number, number] };
    }[];
  }[];
}

export interface OSRMResponse {
  code: string;
  routes: OSRMRoute[];
  waypoints: { name: string; location: [number, number] }[];
}

export async function getRoute(
  start: [number, number], // [lng, lat]
  end: [number, number],
  waypoints?: [number, number][],
): Promise<OSRMResponse | null> {
  const coords = [start, ...(waypoints ?? []), end]
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(';');

  const res = await fetch(
    `/osrm/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
  );
  if (!res.ok) return null;
  return res.json();
}

// Reverse geocode (coordinates → name)
export async function reverseGeocode(lat: number, lng: number): Promise<NominatimResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
  });
  const res = await fetch(`/nominatim/reverse?${params}`);
  if (!res.ok) return null;
  return res.json();
}
