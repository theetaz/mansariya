import { API_BASE_URL } from '../constants/api';
import { getDb } from './offlineDb';

const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
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

export async function syncRoutesIfNeeded(): Promise<void> {
  const db = getDb();
  const result = db.getFirstSync(
    "SELECT value FROM app_meta WHERE key = ?",
    [LAST_SYNC_KEY],
  );
  const lastSync = result ? Number((result as any).value) : 0;
  const now = Date.now();

  const countResult = db.getFirstSync("SELECT COUNT(*) as cnt FROM routes");
  const routeCount = Number((countResult as any)?.cnt ?? 0);

  if (routeCount === 0 || now - lastSync > SYNC_INTERVAL_MS) {
    console.log('[Sync] Route sync needed, fetching...');
    await syncRoutes();
  } else {
    console.log('[Sync] Routes up to date');
  }
}

async function syncRoutes(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/routes/sync`);
    if (!response.ok) return;

    const data = await response.json();
    const routes: SyncRoute[] = data.routes ?? [];
    if (routes.length === 0) return;

    const db = getDb();
    db.execSync("BEGIN TRANSACTION");

    try {
      for (const route of routes) {
        db.runSync(
          `INSERT OR REPLACE INTO routes (id, name_en, name_si, name_ta, operator, service_type, fare_lkr, frequency_minutes, operating_hours, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [route.id, route.name_en, route.name_si, route.name_ta, route.operator, route.service_type, route.fare_lkr, route.frequency_minutes, route.operating_hours, route.is_active ? 1 : 0],
        );
      }
      db.runSync("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [LAST_SYNC_KEY, String(Date.now())]);
      db.execSync("COMMIT");
      console.log(`[Sync] Synced ${routes.length} routes`);
    } catch (e) {
      db.execSync("ROLLBACK");
      throw e;
    }
  } catch (error) {
    console.warn('[Sync] Failed:', error);
  }
}
