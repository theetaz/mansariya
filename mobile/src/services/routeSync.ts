// Route data sync service
// Downloads all routes from the server and caches them in op-sqlite
// for offline search and browsing.

import {API_BASE_URL} from '../constants/api';
import {getDb} from './offlineDb';

const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LAST_SYNC_KEY = 'last_route_sync';

interface SyncRoute {
  id: string;
  name_en: string;
  name_si: string;
  name_ta: string;
  operator: string;
  service_type: string;
  fare_lkr: number;
  frequency_minutes: number;
  operating_hours: string;
  is_active: boolean;
}

/**
 * Check if route data needs syncing and sync if needed.
 * Called on app launch.
 */
export async function syncRoutesIfNeeded(): Promise<void> {
  const db = getDb();

  // Check last sync time
  const result = await db.execute(
    "SELECT value FROM app_meta WHERE key = ?",
    [LAST_SYNC_KEY],
  );
  const rows = result.rows ?? [];
  const lastSync = rows.length > 0 ? Number(rows[0].value) : 0;
  const now = Date.now();

  // Check if we have any routes at all
  const countResult = await db.execute("SELECT COUNT(*) as cnt FROM routes");
  const routeCount = Number((countResult.rows ?? [])[0]?.cnt ?? 0);

  if (routeCount === 0 || now - lastSync > SYNC_INTERVAL_MS) {
    console.log('[Sync] Route sync needed, fetching...');
    await syncRoutes();
  } else {
    console.log('[Sync] Routes up to date');
  }
}

/**
 * Download all routes from server and store in local DB.
 */
async function syncRoutes(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/routes/sync`);
    if (!response.ok) {
      console.warn('[Sync] Server returned', response.status);
      return;
    }

    const data = await response.json();
    const routes: SyncRoute[] = data.routes ?? [];

    if (routes.length === 0) {
      console.warn('[Sync] No routes returned from server');
      return;
    }

    const db = getDb();

    // Insert routes in a transaction
    await db.execute("BEGIN TRANSACTION");

    try {
      for (const route of routes) {
        await db.execute(
          `INSERT OR REPLACE INTO routes (id, name_en, name_si, name_ta, operator, service_type, fare_lkr, frequency_minutes, operating_hours, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            route.id,
            route.name_en,
            route.name_si,
            route.name_ta,
            route.operator,
            route.service_type,
            route.fare_lkr,
            route.frequency_minutes,
            route.operating_hours,
            route.is_active ? 1 : 0,
          ],
        );
      }

      // Update last sync timestamp
      await db.execute(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
        [LAST_SYNC_KEY, String(Date.now())],
      );

      await db.execute("COMMIT");
      console.log(`[Sync] Synced ${routes.length} routes`);
    } catch (e) {
      await db.execute("ROLLBACK");
      throw e;
    }
  } catch (error) {
    console.warn('[Sync] Failed to sync routes:', error);
    // Non-fatal — app works with stale data or empty state
  }
}
