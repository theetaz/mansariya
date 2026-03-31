import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  pingCount: number;

  startTracking: (meta?: Partial<TripMeta>) => void;
  stopTracking: () => void;
  setDetectedRoute: (routeId: string, routeName: string) => void;
  incrementTrips: () => void;
  setPingCount: (count: number) => void;
}

const emptyMeta: TripMeta = { routeId: null, busNumber: null, crowdLevel: null };

export const useTrackingStore = create<TrackingState>()(
  persist(
    (set) => ({
      isTracking: false,
      detectedRouteId: null,
      detectedRouteName: null,
      tripStartTime: null,
      totalTripsShared: 0,
      tripMeta: emptyMeta,
      pingCount: 0,

      startTracking: (meta) =>
        set({
          isTracking: true,
          detectedRouteId: null,
          detectedRouteName: null,
          tripStartTime: Date.now(),
          pingCount: 0,
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
          pingCount: 0,
          totalTripsShared: state.isTracking
            ? state.totalTripsShared + 1
            : state.totalTripsShared,
        })),

      setDetectedRoute: (routeId, routeName) =>
        set({ detectedRouteId: routeId, detectedRouteName: routeName }),

      incrementTrips: () =>
        set((state) => ({ totalTripsShared: state.totalTripsShared + 1 })),

      setPingCount: (count) => set({ pingCount: count }),
    }),
    {
      name: 'mansariya-tracking',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isTracking: state.isTracking,
        tripMeta: state.tripMeta,
        totalTripsShared: state.totalTripsShared,
        tripStartTime: state.tripStartTime,
      }),
    },
  ),
);
