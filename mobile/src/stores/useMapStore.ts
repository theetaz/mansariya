import {create} from 'zustand';
import {BusPosition} from '../services/api';

interface MapState {
  // Camera
  center: [number, number];
  zoom: number;

  // Live bus positions
  buses: Record<string, BusPosition>; // virtual_id → position

  // Selected
  selectedRouteId: string | null;
  selectedBusId: string | null;

  // Actions
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  updateBus: (bus: BusPosition) => void;
  removeBus: (virtualId: string) => void;
  clearBuses: () => void;
  selectRoute: (routeId: string | null) => void;
  selectBus: (busId: string | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [79.8612, 6.9271], // Colombo
  zoom: 13,
  buses: {},
  selectedRouteId: null,
  selectedBusId: null,

  setCenter: (center) => set({center}),
  setZoom: (zoom) => set({zoom}),

  updateBus: (bus) =>
    set((state) => ({
      buses: {...state.buses, [bus.virtual_id]: bus},
    })),

  removeBus: (virtualId) =>
    set((state) => {
      const {[virtualId]: _, ...rest} = state.buses;
      return {buses: rest};
    }),

  clearBuses: () => set({buses: {}}),
  selectRoute: (routeId) => set({selectedRouteId: routeId}),
  selectBus: (busId) => set({selectedBusId: busId}),
}));
