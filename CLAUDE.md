# Athena — Claude working notes

## Dependency PR merge workflow (Dependabot)

When working through open PRs that carry the `dependencies` label (Dependabot
bumps), follow the per-PR workflow: inspect gates → review threads → worktree
install/test → merge → verify main stays green → cleanup.

### Auto-rebase on stale or failing Dependabot CI

If a Dependabot PR cannot be merged because it is **out of date with `main`**
(`mergeStateStatus` is `DIRTY`/`BEHIND`/`CONFLICTING`, `mergeable_state` is
`dirty`/`behind`/`unknown`) or because its **CI is failing on a check that may
just be stale** (e.g. the run predates a prior merge in this batch), do **not**
stop and ask first. Instead:

1. Comment `@dependabot rebase` on the PR to trigger a rebase onto the current
   `main` and a fresh CI run.
2. Wait for the result via `subscribe_pr_activity` (preferred — events wake the
   session) rather than sleep-polling a long-running job. CI here includes a
   Playwright `web#test:e2e` suite that can take ~35 minutes.
3. Re-evaluate the gates once the rebased run completes: all of
   `build` / `test` / `lint` / `docker-build` must be `SUCCESS` (CodeQL
   `neutral` is acceptable), `mergeStateStatus` `CLEAN`, every review thread
   resolved.

### When to STILL stop and report

- The failure **persists after a rebase** against an up-to-date `main` — treat
  it as a genuine regression, STOP, and report which PR caused it.
- A **post-merge** `main` verification (`pnpm install --frozen-lockfile`
  followed by `pnpm test`) fails — STOP immediately, do not proceed to the next
  PR.

### Testing notes

- `pnpm test` runs the **vitest** unit suites only. The CI `test` job also runs
  `web#test:e2e` (Playwright/Chromium), which is **not** covered by a local
  `pnpm test`. A green local `pnpm test` does not guarantee green CI; check the
  PR's `statusCheckRollup` / check runs for the e2e result.
