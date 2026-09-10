import * as SQLite from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

let db: ExpoSQLiteDatabase<typeof schema> | null = null;

export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'checkmark-circle-outline',
  color TEXT NOT NULL DEFAULT 'green', recurrence TEXT NOT NULL DEFAULT 'none',
  weekdays TEXT NOT NULL DEFAULT '[]', sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY, checklist_id TEXT NOT NULL, title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL, title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS occurrences (
  id TEXT PRIMARY KEY, checklist_id TEXT NOT NULL, due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', completed_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS occurrence_items (
  id TEXT PRIMARY KEY, occurrence_id TEXT NOT NULL, source_item_id TEXT NOT NULL,
  group_title TEXT NOT NULL, group_sort_order INTEGER NOT NULL,
  item_title TEXT NOT NULL, sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS item_results (
  occurrence_item_id TEXT PRIMARY KEY, done INTEGER NOT NULL DEFAULT 0, toggled_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS date_exceptions (
  id TEXT PRIMARY KEY, checklist_id TEXT NOT NULL, date TEXT NOT NULL,
  type TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exc_cl_date ON date_exceptions(checklist_id, date);
CREATE INDEX IF NOT EXISTS idx_occ_date ON occurrences(due_date);
CREATE INDEX IF NOT EXISTS idx_occ_cl ON occurrences(checklist_id);
CREATE INDEX IF NOT EXISTS idx_oitem_occ ON occurrence_items(occurrence_id);
`;

export function getDb(): ExpoSQLiteDatabase<typeof schema> {
  if (db) return db;
  const sqlite = SQLite.openDatabaseSync('checklist.db');
  sqlite.execSync(MIGRATION_SQL);
  db = drizzle(sqlite, { schema });
  return db;
}
