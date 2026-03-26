import {create} from 'zustand';

interface TrackingState {
  isTracking: boolean;
  detectedRouteId: string | null;
  detectedRouteName: string | null;
  tripStartTime: number | null;
  totalTripsShared: number;

  startTracking: () => void;
  stopTracking: () => void;
  setDetectedRoute: (routeId: string, routeName: string) => void;
  incrementTrips: () => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  isTracking: false,
  detectedRouteId: null,
  detectedRouteName: null,
  tripStartTime: null,
  totalTripsShared: 0,

  startTracking: () =>
    set({
      isTracking: true,
      detectedRouteId: null,
      detectedRouteName: null,
      tripStartTime: Date.now(),
    }),

  stopTracking: () =>
    set((state) => ({
      isTracking: false,
      detectedRouteId: null,
      detectedRouteName: null,
      tripStartTime: null,
      totalTripsShared: state.isTracking
        ? state.totalTripsShared + 1
        : state.totalTripsShared,
    })),

  setDetectedRoute: (routeId, routeName) =>
    set({detectedRouteId: routeId, detectedRouteName: routeName}),

  incrementTrips: () =>
    set((state) => ({totalTripsShared: state.totalTripsShared + 1})),
}));
