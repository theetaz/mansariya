import {create} from 'zustand';

export interface TripMeta {
  routeId: string | null;
  busNumber: string | null;
  crowdLevel: number | null;
}

interface TrackingState {
  isTracking: boolean;
  detectedRouteId: string | null;
  detectedRouteName: string | null;
  tripStartTime: number | null;
  totalTripsShared: number;
  tripMeta: TripMeta;

  startTracking: (meta?: Partial<TripMeta>) => void;
  stopTracking: () => void;
  setDetectedRoute: (routeId: string, routeName: string) => void;
  incrementTrips: () => void;
}

const emptyMeta: TripMeta = { routeId: null, busNumber: null, crowdLevel: null };

export const useTrackingStore = create<TrackingState>((set) => ({
  isTracking: false,
  detectedRouteId: null,
  detectedRouteName: null,
  tripStartTime: null,
  totalTripsShared: 0,
  tripMeta: emptyMeta,

  startTracking: (meta) =>
    set({
      isTracking: true,
      detectedRouteId: null,
      detectedRouteName: null,
      tripStartTime: Date.now(),
      tripMeta: {
        routeId: meta?.routeId ?? null,
        busNumber: meta?.busNumber ?? null,
        crowdLevel: meta?.crowdLevel ?? null,
      },
    }),

  stopTracking: () =>
    set((state) => ({
      isTracking: false,
      detectedRouteId: null,
      detectedRouteName: null,
      tripStartTime: null,
      tripMeta: emptyMeta,
      totalTripsShared: state.isTracking
        ? state.totalTripsShared + 1
        : state.totalTripsShared,
    })),

  setDetectedRoute: (routeId, routeName) =>
    set({detectedRouteId: routeId, detectedRouteName: routeName}),

  incrementTrips: () =>
    set((state) => ({totalTripsShared: state.totalTripsShared + 1})),
}));
