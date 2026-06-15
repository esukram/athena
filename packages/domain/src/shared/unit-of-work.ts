/**
 * Unit of work — the transactional boundary port. A use case wraps its
 * multi-write work in `run()` so the writes commit all-or-nothing. The domain
 * stays ignorant of the persistence technology; the infrastructure layer
 * (`apps/server`) implements this with better-sqlite3's synchronous
 * `db.transaction()`.
 *
 * `work` is synchronous on purpose: better-sqlite3 transactions cannot span an
 * `await`, and the curriculum use cases are synchronous, so keeping the
 * boundary synchronous makes the all-or-nothing guarantee real rather than
 * accidental.
 */
export interface UnitOfWork {
  run<T>(work: () => T): T;
}

/**
 * A pass-through unit of work that runs `work` with no transaction. Useful in
 * tests and any context where atomicity is provided elsewhere.
 */
export const noopUnitOfWork: UnitOfWork = {
  run: (work) => work(),
};
