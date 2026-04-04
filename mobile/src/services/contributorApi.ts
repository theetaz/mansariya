import api from './api';
import {ENDPOINTS} from '../constants/api';

// ── Types ────────────────────────────────────────────────────────────────

export interface Contributor {
  id: string;
  contributor_id: string;
  display_name?: string;
  status: 'anonymous' | 'claimed' | 'disabled';
  claimed_at?: string;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ContributionStats {
  contributor_id: string;
  total_trips: number;
  total_pings: number;
  total_distance_km: number;
  quality_score: number;
  noise_count: number;
  potential_count: number;
  cluster_count: number;
  confirmed_count: number;
  routes_contributed: number;
  stops_discovered: number;
  active_days: number;
  first_contribution_at?: string;
  last_contribution_at?: string;
}

export interface LeaderboardEntry {
  rank: number;
  contributor_id: string;
  display_name?: string;
  total_trips: number;
  total_pings: number;
  total_distance_km: number;
  quality_score: number;
  active_days: number;
}

export interface AuthTokens {
  contributor: Contributor;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

// ── Public endpoints ─────────────────────────────────────────────────────

export async function fetchLeaderboard(
  sort?: string,
  limit = 50,
  offset = 0,
): Promise<{leaderboard: LeaderboardEntry[]; total: number; limit: number; offset: number}> {
  const {data} = await api.get(ENDPOINTS.CONTRIBUTOR_LEADERBOARD, {
    params: {sort, limit, offset},
  });
  return data;
}

export async function contributorLogin(
  displayName: string,
  password: string,
): Promise<AuthTokens> {
  const {data} = await api.post(ENDPOINTS.CONTRIBUTOR_LOGIN, {
    display_name: displayName,
    password,
  });
  return data;
}

export async function contributorRefresh(
  refreshToken: string,
): Promise<AuthTokens> {
  const {data} = await api.post(ENDPOINTS.CONTRIBUTOR_REFRESH, {
    refresh_token: refreshToken,
  });
  return data;
}

export async function contributorLogout(
  refreshToken: string,
): Promise<void> {
  await api.post(ENDPOINTS.CONTRIBUTOR_LOGOUT, {
    refresh_token: refreshToken,
  });
}

// ── Authenticated endpoints (require Bearer token via interceptor) ───────

export async function fetchContributorProfile(): Promise<{
  contributor: Contributor;
  stats: ContributionStats;
}> {
  const {data} = await api.get(ENDPOINTS.CONTRIBUTOR_ME);
  return data;
}

export async function fetchContributorStats(): Promise<ContributionStats> {
  const {data} = await api.get(ENDPOINTS.CONTRIBUTOR_STATS);
  return data;
}

export async function claimContributor(
  displayName: string,
  password: string,
): Promise<{status: string; contributor: Contributor}> {
  const {data} = await api.post(ENDPOINTS.CONTRIBUTOR_CLAIM, {
    display_name: displayName,
    password,
  });
  return data;
}
