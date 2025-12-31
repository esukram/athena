import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

const dbDir = process.env.DB_PATH || path.join(process.cwd(), '../../');
export const db: DatabaseType = new Database(dbDir + '/athena.db');
