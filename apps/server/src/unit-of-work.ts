import { type Database } from 'better-sqlite3';

import { type UnitOfWork } from '@athena/domain';

/**
 * SQLite-backed {@link UnitOfWork}. better-sqlite3's `db.transaction(fn)`
 * returns a wrapper that runs `fn` inside a transaction, committing on return
 * and rolling back if it throws. Nested calls reuse SAVEPOINTs, so a use case
 * can safely run inside an outer transaction.
 */
export function createUnitOfWork(db: Database): UnitOfWork {
  return {
    run: <T>(work: () => T): T => db.transaction(work)(),
  };
}
