import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Contributor, ContributionStats} from '../services/contributorApi';

interface ContributorState {
  // Persisted
  contributorId: string | null;
  displayName: string | null;
  status: 'anonymous' | 'claimed' | 'disabled' | null;
  stats: ContributionStats | null;

  // Runtime only
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setContributor: (c: Contributor) => void;
  setStats: (s: ContributionStats) => void;
  setAuthenticated: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  clear: () => void;
}

export const useContributorStore = create<ContributorState>()(
  persist(
    (set) => ({
      contributorId: null,
      displayName: null,
      status: null,
      stats: null,
      isAuthenticated: false,
      isLoading: false,

      setContributor: (c) =>
        set({
          contributorId: c.contributor_id,
          displayName: c.display_name ?? null,
          status: c.status,
        }),

      setStats: (s) => set({stats: s}),

      setAuthenticated: (v) => set({isAuthenticated: v}),

      setLoading: (v) => set({isLoading: v}),

      clear: () =>
        set({
          contributorId: null,
          displayName: null,
          status: null,
          stats: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: 'mansariya-contributor',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        contributorId: state.contributorId,
        displayName: state.displayName,
        status: state.status,
        stats: state.stats,
      }),
    },
  ),
);
