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

### react / react-dom version coupling (must always match)

`react` and `react-dom` **must resolve to the exact same version** in the
lockfile. A mismatch (e.g. `react@19.2.6` + `react-dom@19.2.4`) causes React
to throw at mount; the app never renders, and all 44 Playwright e2e tests time
out. The `build` / vitest jobs still pass, so the failure is only visible in CI
`web#test:e2e`.

When a Dependabot PR bumps `react` (or `react-dom`):

1. Check both resolved versions in the lockfile:
   ```
   grep -A1 "^  react@" pnpm-lock.yaml | grep "resolution:"
   grep -A1 "^  react-dom@" pnpm-lock.yaml | grep "resolution:"
   ```
2. If they differ, align **both** specifiers to `^X.Y.Z` using the **higher**
   of the two resolved patch versions, then run `pnpm install --lockfile-only`
   to regenerate.
3. Confirm the lockfile now shows identical versions for both with no peer
   warnings before committing and pushing to the Dependabot branch.

### pnpm.overrides consistency check

The root `package.json` contains a `pnpm.overrides` block that hard-pins
certain packages. **Dependabot does not update `pnpm.overrides`** — it only
updates `package.json` dependency specifiers and the lockfile.

When a Dependabot PR bumps a package that also appears in `pnpm.overrides`:

1. Compare the bumped version in `packages/*/package.json` against the value in
   root `pnpm.overrides`.
2. If they differ, update the root `pnpm.overrides` entry to match the new
   version **before** running `pnpm install`. Failing to do this results in
   `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` on `pnpm install --frozen-lockfile`.
3. Regenerate the lockfile with `pnpm install` (unfrozen), then verify
   `pnpm install --frozen-lockfile` passes cleanly.

Known packages that appear in both workspace `package.json` files and root
`pnpm.overrides`: `eslint-plugin-react-hooks`.

### eslint-plugin lint-tightening

When bumping an eslint plugin, run `pnpm lint` **after** fixing installation.
New major/minor versions of eslint plugins often introduce stricter rules that
flag previously-ignored patterns in application source.

If `pnpm lint` fails with errors in application source files (not just config):

1. Collect the full error list: files, line numbers, rule names, messages.
2. Present the errors and the following options to the user before committing:
   - **(A) Suppress** — add targeted `// eslint-disable-next-line <rule>` at
     each error site with a brief justification comment.
   - **(B) Refactor** — fix the flagged patterns properly (preferred if the
     code change is small and clearly correct).
   - **(C) Skip** — close the PR and keep the old plugin version.
3. Do **not** blindly suppress errors without user approval.
