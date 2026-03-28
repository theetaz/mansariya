import api from './api';
import type {
  AdminRouteInput,
  AdminRouteWithStats,
  AdminStopInput,
  DashboardStats,
  HealthResponse,
  Route,
  Stop,
  TimetableInput,
  Vehicle,
} from './types';

// ── Health ──
export const fetchHealth = () =>
  api.get<HealthResponse>('/').then((r) => r.data);

// ── Public ──
export const fetchRoutes = () =>
  api.get<{ routes: Route[]; count: number }>('/api/v1/routes/sync').then((r) => r.data);

export const fetchRoute = (id: string) =>
  api.get<{ route: Route; stops: Stop[] }>(`/api/v1/routes/${id}`).then((r) => r.data);

export const fetchActiveBuses = () =>
  api.get<{ buses: Vehicle[]; count: number }>('/api/v1/buses/active').then((r) => r.data);

export const searchRoutes = (q: string) =>
  api.get<{ results: Route[]; count: number }>(`/api/v1/search?q=${encodeURIComponent(q)}`).then((r) => r.data);

// ── Admin: Dashboard ──
export const fetchAdminStats = () =>
  api.get<DashboardStats>('/api/v1/admin/stats').then((r) => r.data);

export const fetchAdminRoutes = () =>
  api.get<{ routes: AdminRouteWithStats[]; count: number }>('/api/v1/admin/routes').then((r) => r.data);

// ── Admin: Routes CRUD ──
export const createRoute = (data: AdminRouteInput) =>
  api.post('/api/v1/admin/routes', data).then((r) => r.data);

export const updateRoute = (id: string, data: Partial<AdminRouteInput>) =>
  api.put(`/api/v1/admin/routes/${id}`, data).then((r) => r.data);

export const deleteRoute = (id: string) =>
  api.delete(`/api/v1/admin/routes/${id}`).then((r) => r.data);

// ── Admin: Stops CRUD ──
export const createStop = (data: AdminStopInput) =>
  api.post('/api/v1/admin/stops', data).then((r) => r.data);

export const updateStop = (id: string, data: Partial<AdminStopInput>) =>
  api.put(`/api/v1/admin/stops/${id}`, data).then((r) => r.data);

// ── Admin: Route associations ──
export const setRouteStops = (routeId: string, stops: { stop_id: string; stop_order: number }[]) =>
  api.put(`/api/v1/admin/routes/${routeId}/stops`, { stops }).then((r) => r.data);

export const setTimetable = (routeId: string, entries: TimetableInput[]) =>
  api.put(`/api/v1/admin/routes/${routeId}/timetable`, { entries }).then((r) => r.data);

export const updatePolyline = (routeId: string, coordinates: [number, number][], confidence: number) =>
  api.put(`/api/v1/admin/routes/${routeId}/polyline`, { coordinates, confidence }).then((r) => r.data);
