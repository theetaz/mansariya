import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('masariya.db');
    initSchema();
  }
  return db;
}

function initSchema() {
  const d = getDb();
  d.execSync(`CREATE TABLE IF NOT EXISTS routes (
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
  )`);
  d.execSync(`CREATE TABLE IF NOT EXISTS stops (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_si TEXT,
    name_ta TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL
  )`);
  d.execSync(`CREATE TABLE IF NOT EXISTS route_stops (
    route_id TEXT,
    stop_id TEXT,
    stop_order INTEGER,
    PRIMARY KEY (route_id, stop_id, stop_order)
  )`);
  d.execSync(`CREATE TABLE IF NOT EXISTS favorites (
    route_id TEXT PRIMARY KEY,
    added_at INTEGER DEFAULT (strftime('%s', 'now'))
  )`);
  d.execSync(`CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
}

export async function searchRoutesOffline(query: string, limit = 20) {
  const d = getDb();
  const results = d.getAllSync(
    `SELECT id, name_en, name_si, name_ta, operator, fare_lkr, frequency_minutes
     FROM routes
     WHERE id LIKE ? OR name_en LIKE ? OR name_si LIKE ? OR name_ta LIKE ?
     LIMIT ?`,
    [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit],
  );
  return results;
}

export async function addFavorite(routeId: string) {
  getDb().runSync('INSERT OR REPLACE INTO favorites (route_id) VALUES (?)', [routeId]);
}

export async function removeFavorite(routeId: string) {
  getDb().runSync('DELETE FROM favorites WHERE route_id = ?', [routeId]);
}

export async function getFavorites() {
  return getDb().getAllSync(
    `SELECT r.* FROM routes r
     INNER JOIN favorites f ON r.id = f.route_id
     ORDER BY f.added_at DESC`,
  );
}

export async function isFavorite(routeId: string): Promise<boolean> {
  const result = getDb().getFirstSync(
    'SELECT COUNT(*) as count FROM favorites WHERE route_id = ?',
    [routeId],
  );
  return Number((result as any)?.count ?? 0) > 0;
}
