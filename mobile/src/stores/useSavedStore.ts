import {create} from 'zustand';
import {Route} from '../services/api';

interface SavedState {
  savedRoutes: Route[];
  addRoute: (route: Route) => void;
  removeRoute: (routeId: string) => void;
  isSaved: (routeId: string) => boolean;
}

export const useSavedStore = create<SavedState>((set, get) => ({
  savedRoutes: [],

  addRoute: (route) =>
    set((state) => {
      if (state.savedRoutes.some((r) => r.id === route.id)) return state;
      return {savedRoutes: [...state.savedRoutes, route]};
    }),

  removeRoute: (routeId) =>
    set((state) => ({
      savedRoutes: state.savedRoutes.filter((r) => r.id !== routeId),
    })),

  isSaved: (routeId) => get().savedRoutes.some((r) => r.id === routeId),
}));
