// Offline database using op-sqlite
// Stores route data, stops, and favorites locally for offline access

import {open, type DB} from '@op-engineering/op-sqlite';

let db: DB | null = null;

export function getDb(): DB {
  if (!db) {
    db = open({name: 'masariya.db'});
    initSchema();
  }
  return db;
}

function initSchema() {
  const d = getDb();

  d.execute(
    `CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_si TEXT,
      name_ta TEXT,
      operator TEXT,
      service_type TEXT,
      fare_lkr INTEGER,
      frequency_minutes INTEGER,
      operating_hours TEXT,
      is_active INTEGER DEFAULT 1
    )`,
  );

  d.execute(
    `CREATE TABLE IF NOT EXISTS stops (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_si TEXT,
      name_ta TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL
    )`,
  );

  d.execute(
    `CREATE TABLE IF NOT EXISTS route_stops (
      route_id TEXT,
      stop_id TEXT,
      stop_order INTEGER,
      PRIMARY KEY (route_id, stop_id, stop_order)
    )`,
  );

  d.execute(
    `CREATE TABLE IF NOT EXISTS favorites (
      route_id TEXT PRIMARY KEY,
      added_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
  );

  // FTS5 for trilingual search
  d.execute(
    `CREATE VIRTUAL TABLE IF NOT EXISTS routes_fts USING fts5(
      id, name_en, name_si, name_ta
    )`,
  );
}

// Search routes offline
export async function searchRoutesOffline(query: string, limit = 20) {
  const d = getDb();
  const results = await d.execute(
    `SELECT id, name_en, name_si, name_ta, operator, fare_lkr, frequency_minutes
     FROM routes
     WHERE id LIKE ? OR name_en LIKE ? OR name_si LIKE ? OR name_ta LIKE ?
     LIMIT ?`,
    [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit],
  );
  return results.rows ?? [];
}

// Favorites
export async function addFavorite(routeId: string) {
  await getDb().execute(
    'INSERT OR REPLACE INTO favorites (route_id) VALUES (?)',
    [routeId],
  );
}

export async function removeFavorite(routeId: string) {
  await getDb().execute('DELETE FROM favorites WHERE route_id = ?', [routeId]);
}

export async function getFavorites() {
  const d = getDb();
  const results = await d.execute(
    `SELECT r.* FROM routes r
     INNER JOIN favorites f ON r.id = f.route_id
     ORDER BY f.added_at DESC`,
  );
  return results.rows ?? [];
}

export async function isFavorite(routeId: string): Promise<boolean> {
  const d = getDb();
  const result = await d.execute(
    'SELECT COUNT(*) as count FROM favorites WHERE route_id = ?',
    [routeId],
  );
  const rows = result.rows ?? [];
  return Number(rows[0]?.count ?? 0) > 0;
}
