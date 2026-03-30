import {create} from 'zustand';
import {BusPosition} from '../services/api';

interface BusEntry extends BusPosition {
  _lastSeen: number; // local timestamp for stale detection
}

interface MapState {
  center: [number, number];
  zoom: number;
  buses: Record<string, BusEntry>;
  selectedRouteId: string | null;
  selectedBusId: string | null;

  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  updateBus: (bus: BusPosition) => void;
  removeBus: (virtualId: string) => void;
  clearBuses: () => void;
  removeStaleBuses: (maxAgeMs?: number) => void;
  selectRoute: (routeId: string | null) => void;
  selectBus: (busId: string | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [79.8612, 6.9271],
  zoom: 13,
  buses: {},
  selectedRouteId: null,
  selectedBusId: null,

  setCenter: (center) => set({center}),
  setZoom: (zoom) => set({zoom}),

  updateBus: (bus) =>
    set((state) => ({
      buses: {...state.buses, [bus.virtual_id]: {...bus, _lastSeen: Date.now()}},
    })),

  removeBus: (virtualId) =>
    set((state) => {
      const {[virtualId]: _, ...rest} = state.buses;
      return {buses: rest};
    }),

  clearBuses: () => set({buses: {}}),

  removeStaleBuses: (maxAgeMs = 30000) =>
    set((state) => {
      const cutoff = Date.now() - maxAgeMs;
      const fresh: Record<string, BusEntry> = {};
      for (const [id, bus] of Object.entries(state.buses)) {
        if (bus._lastSeen >= cutoff) {
          fresh[id] = bus;
        }
      }
      return {buses: fresh};
    }),

  selectRoute: (routeId) => set({selectedRouteId: routeId}),
  selectBus: (busId) => set({selectedBusId: busId}),
}));
