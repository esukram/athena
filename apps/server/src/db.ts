import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

/**
 * Opens a better-sqlite3 database. With no argument it resolves the on-disk
 * location from `DB_PATH` (falling back to the repo root), joining the path
 * with `path.join` rather than string concatenation. Passing an explicit path
 * (e.g. `':memory:'`) lets tests and alternate hosts inject their own database
 * without mocking the module.
 */
export function createDatabase(dbPath?: string): DatabaseType {
  const dbDir = process.env.DB_PATH || path.join(process.cwd(), '../../');
  return new Database(dbPath ?? path.join(dbDir, 'athena.db'));
}
