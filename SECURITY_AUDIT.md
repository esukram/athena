# Athena — Final Security Audit Report

**Repository:** `/home/markus/dev/athena`
**Audit scope:** Fastify server (`apps/server`), tRPC API (`packages/api`), web client (`apps/web`), container & CI/CD config
**Severity basis:** Verifier-adjusted severities (not finder-original). Shared-root-cause findings merged.

---

## 0. Deployment-Context Addendum — nginx Basic Auth over HTTPS (REVISED THREAT MODEL)

> Added after the operator confirmed: **Athena runs behind an nginx reverse proxy that enforces HTTP Basic Auth over HTTPS.** This places an authentication boundary in front of the app — exactly the control F1 reported as missing — and re-rates much of the report below. The findings sections are preserved as-written; this section is the authoritative re-rating.

**Net effect:** The proxy front-door collapses the report's dominant theme. The original **High** (F1) and **Medium** (F2) both drop, *conditional* on the proxy actually being the only path to the app. The risk shifts from "anyone on the network has full control" to **"is there a way to bypass the proxy, and is the single Basic-Auth credential strong?"**

### Revised severity ladder (deployment-aware)

| Item | Was | Now | Why it changed |
|------|-----|-----|----------------|
| **D1 — Proxy-bypass / direct exposure of `:4000`** | (part of F1) | **High *until verified*** | The app still binds `0.0.0.0:4000` (`index.ts:334`) with no app-level auth; every procedure is public (`trpc.ts:50`). If the container publishes 4000 to the host/internet (`-p 4000:4000`) instead of only to nginx's network, Basic Auth is fully bypassed and full unauthenticated CRUD + TTS abuse return. **The gating control: High until the operator confirms no bypass path, then closed/monitored.** |
| **D2 — Basic-Auth strength / brute-force** | (new) | **Info — resolved** | Operator confirmed: **single-user deployment, strong password, fail2ban configured.** Over HTTPS with fail2ban throttling 401s, the brute-force vector is closed. Residual is routine credential hygiene (rotation, don't reuse). |
| **F1 — No app-level auth** | High | **Low residual** (after D1 verified) | Mitigated by the proxy *as long as D1 holds*. Keep as residual: app has no second layer if the proxy is misconfigured or removed. |
| **F2 — Paid-TTS cost amplification** | Medium | **Low** | Single-user + strong password confirmed, so the shared-credential/multi-user angle is gone. Residual is narrow: an accidental huge paste by the legitimate user, or abuse if the password ever leaks. The one-line `.max()` (F2 fix) + a cloud spend cap (D3) fully cover it cheaply. |
| **F3 — Wide-open CORS** | Low | **Low** (browser-boundary hardening) | Same-origin behind the proxy, and `@fastify/cors` `origin: true` does **not** set `Access-Control-Allow-Credentials`, so credentialed cross-origin reads are blocked and preflighted JSON mutations can't carry creds. But do **not** sell this as a complete CSRF mitigation: browser-cached Basic Auth makes requests ambiently authenticated, and the policy is one careless `credentials: true` away from breaking. Set `origin: false` / real origin in production. |
| **F5/F9/F10/F11** | Low/Info | **Info** | All now only reachable post-authentication; recommendations unchanged but lower urgency. |
| **F4, F6, F7, F8, F12** | Low/Info | **unchanged** | Not auth-dependent (data-integrity, supply-chain, resource hygiene). |

### New / elevated action items from this context

> *This re-rating was independently reviewed by GPT-5.5 (via Codex); its refinements are incorporated — notably D1 at High-until-verified, F2 held at Low–Medium, F3 kept at Low rather than Info, and the new edge/cloud items D3–D6.*

1. **[D1 — verify first, High until done] Confirm `:4000` is not reachable except via nginx.** Publish the container port only to the proxy: bind to loopback (`-p 127.0.0.1:4000:4000`) or keep it on an internal Docker network with no host port mapping. Do **not** publish `0.0.0.0:4000` to the internet. This single check is what keeps F1 mitigated.
2. **[D2 — largely satisfied] Basic-Auth front door.** ✅ single-user, strong password, fail2ban configured. Remaining checks: ensure HSTS + TLS-only redirect (credentials never traverse plain HTTP) and that **Basic Auth covers *all* routes** — `/api/trpc`, static assets, and SPA-fallback paths — not just the app root.
3. **[D3 — the real F2 backstop] Set cloud-side TTS quotas / budget alerts** on the Google + Azure projects. App `.max()` bounds one request; a provider spend cap bounds total abuse regardless of app logic.
4. **[D4] Add `client_max_body_size` at nginx** (plus a smaller Fastify `bodyLimit`) — caps TTS fan-out and oversized DB rows at the edge.
5. **[D5] Lock down the TTS service-account.** Mount the Google SA JSON / Azure key file **read-only, outside `/data`**; least-privilege the GCP service account to TTS only; rotate the key if the shared Basic Auth password ever leaks.
6. **[D6] SQLite backups + restore testing.** Basic Auth does nothing against accidental or authorized destructive mutations (no per-user authz; FK cascade inert per F6) — backups are the recovery control.
7. **[F2, still cheap] Add `text: z.string().min(1).max(5000)`** — independent of auth, protects against accidental/insider cost blowups.
8. Keep the **defense-in-depth** items (F3 `origin:false`, F5 opaque provider errors, F6 FK pragma) on the backlog; low-cost, not urgent. *(SSML validator `speech.ts:38` allowlists tag names but not attributes — not a serious breakout path given the allowed tags, but an XML parser + attribute allowlist is cleaner if it's ever touched.)*

> Bottom line: single-user behind nginx Basic Auth over HTTPS with a strong password and fail2ban — D2 (brute-force/credential) is **resolved** and F2 drops to **Low**. The posture is **good**, now gated on essentially **one** open item: **D1 — confirm `:4000` is not directly reachable, bypassing nginx.** That single check is what makes every front-door control (auth, strong password, fail2ban) actually apply; if the port is exposed, all of them are bypassed and F1 returns at High. Everything else (D3 cloud spend cap, F3 `origin:false`, F5/F6, supply-chain, headers) is low-cost defense-in-depth. The codebase remains technically clean (no injection/XSS/secret-leak); residual risk is purely *deployment/configuration*.

---

## 1. Executive Summary

Athena is a self-hosted, single-user lecture/flashcard study tool with **no authentication or authorization anywhere by design**. Every tRPC procedure is a `publicProcedure`; `createContext` injects only repositories and no principal. This single design decision is the dominant theme of the entire audit: the server binds `0.0.0.0:4000`, the Dockerfile `EXPOSE`s that port, CORS is wide open (`origin: true`), and there is no rate limiting, request timeout, or input length cap. The practical consequence is that any client able to reach the port has full unauthenticated read/create/update/delete over all lecture data and can invoke the paid cloud-TTS endpoint.

The most important theme is therefore **not** a single exotic bug but the **absence of a security boundary on a network-exposed, mutating, cost-incurring API**. Almost every other confirmed finding (CORS, CSRF framing, unbounded inputs, search N+1, error-body leakage, missing security headers) is either a manifestation or a thin amplifier of that root cause, and most collapse to low/info once the no-auth posture is acknowledged and tracked once. The genuinely *additive* risk that survives de-duplication is the **paid-TTS cost-amplification vector**: unbounded `text` input fans out to ~200 sequential billable Google synthesis calls per request, an independently fixable financial-DoS primitive. Supply-chain hygiene (unpinned actions/base image, no CI scanning, floating `turbo`) is sound-but-improvable and entirely low/info.

### Severity Tally (post-merge, verifier-adjusted)

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 0 | — |
| High | 1 | F1 (no auth — root cause; absorbs the CORS/CSRF/DoS/rate-limit manifestations) |
| Medium | 1 | F2 (unauthenticated paid-TTS cost amplification) |
| Low | 6 | F3 CORS, F4 search N+1, F5 upstream error-body leak, F6 FK enforcement off, F7 supply-chain pinning (actions + base image), F8 floating `turbo`/CI hygiene |
| Info | 4 | F9 missing security headers, F10 tRPC error-formatter stack leak, F11 unredacted logger, F12 oversized DB rows / audio buffering |

> Note on ranking: the finder JSON contains several entries originally rated *critical/high* (no-auth, CORS, multiple TTS/DoS duplicates). The verifier downgraded the no-auth finding to **high** and every TTS/CORS/DoS duplicate to **medium/low**, and explicitly instructed that the per-route "missing auth" variants and the CORS/CSRF/rate-limit/oversized-input items must be folded into the single root-cause finding rather than counted as independent criticals. This report follows that guidance.

---

## 2. Findings

### F1 — `[HIGH]` No authentication or authorization on any route (root cause)

**Location:** `packages/api/src/trpc.ts:50-52` (`createContext`), `:70` (`publicProcedure`); wiring in `apps/server/src/index.ts:285-308`, listen at `:334`
**CWE:** CWE-306 (Missing Authentication for Critical Function), CWE-862 (Missing Authorization)
**Merged manifestations:** wide-open CORS, CSRF-ability, no rate limiting / no request timeout, mass-assignment-via-spread, cross-origin data reads — all derive from this gap.

**Root cause.** `createContext = (deps) => async () => deps` injects only the three repositories plus an optional `speechService` — no token, session, or principal. The Fastify adapter's `req`/`res` are not even threaded into context, so a header check is impossible without code changes. `publicProcedure = t.procedure` is the *only* procedure type; there is no `protectedProcedure` or auth middleware anywhere in `packages/api/src`. Every endpoint across `lectures`, `chapters`, `questions`, and `speech` routers uses it, including all mutations (`createLecture`/`updateLecture`/`deleteLecture`, create/update/delete chapter & question, `moveChapter`, `reorderChapter`) and `speech.synthesize`. The server then binds `0.0.0.0:4000` with no TLS, no auth proxy assumed, and `cors { origin: true }`.

**Attack scenario.** An unauthenticated client reaching `http://host:4000` enumerates everything via `lectures.getLectures`, then wipes or tampers data:
```
curl 'http://host:4000/api/trpc/lectures.deleteLecture' \
  -H 'content-type: application/json' -d '{"id":"<uuid>"}'
```
No challenge is ever issued. Because CORS reflects any origin, a malicious web page a victim visits can drive the same cross-origin requests against an instance reachable from the victim's browser (LAN / `localhost`), using the victim's browser as a network-position proxy — and read the responses back, since `application/json` POSTs trigger a preflight that `origin: true` approves.

**Evidence.**
```ts
// packages/api/src/trpc.ts:50-52
createContext = (deps) => async () => deps;     // no principal
// packages/api/src/trpc.ts:70
export const publicProcedure = t.procedure;     // sole procedure type, used everywhere
// apps/server/src/index.ts:285-287
await server.register(cors, { origin: true });  // "Allow all origins for dev simplicity"
// apps/server/src/index.ts:334
await server.listen({ port: 4000, host: '0.0.0.0' });
```

**Remediation.**
1. Thread the Fastify `req` into context (the `@trpc/server` fastify adapter passes `{ req, res }` to `createContext`).
2. Add a `protectedProcedure` middleware that throws `TRPCError({ code: 'UNAUTHORIZED' })`; verify a bearer token / API key / shared secret from request headers. At minimum gate all mutations and `speech.synthesize` behind an env-var secret (skip-when-unset to preserve zero-config local dev, but log a startup warning).
3. Replace `origin: true` with an explicit allowlist (the app is served same-origin, so `origin: false` is also viable — see F3), and default-bind to `127.0.0.1` unless network exposure is explicitly configured.
4. Document the intended exposure model; do not rely on "behind a trusted network" being true.

---

### F2 — `[MEDIUM]` Unauthenticated paid cloud-TTS endpoint enables cost/quota amplification

**Location:** input schema `packages/api/src/routers/speech.ts:10` (`text: z.string().min(1)`, **no `.max()`**); fan-out in `apps/server/src/google-speech.ts:158`, `:209-212`; Fastify setup `apps/server/src/index.ts:280-282`
**CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
**Merged manifestations:** four separate finder entries on the same unbounded-`text`/fan-out vector are consolidated here.

**Root cause.** `speech.synthesize` is a `publicProcedure` relaying text to a billable provider under the server's service-account identity. The `text` input has a `.min(1)` but **no maximum length**. Fastify is created as `Fastify({ logger: true })` with no `bodyLimit` override, so the default ~1 MiB body applies. On the Google path, `chunkText(input, MAX_INPUT_BYTES=4800)` splits input and the loop issues **one awaited billable `texttospeech.googleapis.com` call per chunk, sequentially**:
```ts
const chunks = chunkText(input, MAX_INPUT_BYTES);          // google-speech.ts:158
for (const chunk of chunks) parts.push(await synthesizeChunk(chunk)); // :209-212
```
A single ~1 MiB request therefore fans out to **~200 paid synthesis calls**. With no auth and no rate limit, an attacker loops this to drain quota / accrue cloud spend; each request also ties up the event loop on ~200 sequential round-trips. The Azure path is uncapped too but issues a single call (no fan-out).

**Why this survives de-duplication from F1.** Unlike the local-SQLite CRUD endpoints, this one converts anonymous input directly into **monetary cost** on Azure/Google. The amplification factor (1 request → ~200 metered calls) and the missing `.max()` are independently fixable defects whose remediation is valuable *regardless* of the auth decision. Downgraded from the finder's *high* to **medium** because: impact is gated on a real TTS provider actually being configured (otherwise `speech.ts:16-18` throws "Speech service not configured" before any billing); per-request fan-out is bounded by Fastify's 1 MiB default; and on any exposed instance the same actor can already cause equally damaging data destruction via F1.

**Attack scenario.** Reach port 4000 (directly or cross-origin via a victim browser), POST `speech.synthesize` with `format:text` and ~1 MiB of `text`, loop. Each request bills ~200 Chirp 3 HD synthesis calls; a few hundred requests exhaust daily quota or generate large unexpected spend.

**Remediation.**
1. **Highest-value, lowest-risk:** add `text: z.string().min(1).max(N)` in `speech.ts` sized to the single-answer use case (e.g. `.max(5000)`, a small multiple of `MAX_INPUT_BYTES`). This alone collapses per-request fan-out from ~200 to ~1–2 chunks and rejects oversized input before any outbound call.
2. Optionally cap `chunks.length` in `google-speech.ts` as defense in depth, and lower the Fastify `bodyLimit`.
3. For network-exposed deployments, gate `synthesize` behind auth (F1) and register `@fastify/rate-limit` scoped to the synthesize path, plus an outbound daily-call budget.

---

### F3 — `[LOW]` Wide-open CORS (`origin: true`) on the no-auth API

**Location:** `apps/server/src/index.ts:285-287`
**CWE:** CWE-942 (Permissive Cross-domain Policy with Untrusted Domains)

**Root cause.** `@fastify/cors` is registered with `origin: true` ("Allow all origins for dev simplicity"), reflecting any `Origin` into `Access-Control-Allow-Origin` and approving preflights for every site. Combined with F1 (no auth), this lets any page a victim visits issue cross-origin `fetch()` against a reachable Athena instance and read the JSON responses.

**Incremental risk over F1.** No cookies/credentials are used, so this is **not** credential-theft/session-riding CSRF. The genuine non-overlapping risk is a **drive-by/SSRF-from-browser** angle: a victim browsing `attacker.com` whose browser can reach an otherwise-internal instance (`localhost:4000` or RFC1918 LAN) can have their browser used as a proxy to exfiltrate or mutate data the attacker could not otherwise reach. tRPC mutations are `application/json` POSTs (non-simple → preflight), so a *strict* CORS policy genuinely would block the cross-origin path — CORS is not cosmetic here. For an already-internet-exposed instance, CORS adds nothing (direct server-to-server access works). Hence **low**, not the finder's high/medium.

**Evidence.**
```ts
await server.register(cors, { origin: true /* Allow all origins for dev simplicity */ });
```

**Remediation.** The SPA is served **same-origin** from this very Fastify server (`index.ts:315-318`), so CORS is unnecessary — set `origin: false` (or remove the registration) to close the cross-origin drive-by/LAN-exfiltration vector even while the app remains unauthenticated. If cross-origin access is ever needed, use an explicit env-sourced allowlist rather than reflecting arbitrary origins.

---

### F4 — `[LOW]` `chapters.searchChapters` builds one LIKE per token with no token cap (N+1 + algorithmic cost)

**Location:** `apps/server/src/index.ts:77-133` (`createChapterRepository().search`); input schema `packages/api/src/routers/chapters.ts:28-29`
**CWE:** CWE-1333 / CWE-770 (Inefficient algorithmic complexity / unbounded resources)

**Root cause.** `search()` splits the query on whitespace into an **unbounded** token list (`index.ts:80`) and builds one `LOWER(...) LIKE ?` predicate per token, AND-joined, over `chapters LEFT JOIN questions`. The input is `z.string()` with no `.max()`. Then, for **each** returned chapter row, it runs an *additional* prepared query re-applying all per-token conditions (`index.ts:114-129`) — an N+1 where both N and per-row clause count are attacker-influenced. Leading-wildcard `%token%` cannot use indexes. Parameters are correctly bound (no SQL injection — see appendix).

**Why low, not the finder's medium.** SQLite's `SQLITE_MAX_VARIABLE_NUMBER` (32766 modern / 999 older) means tens of thousands of tokens cause `too many SQL variables` and the statement throws cheaply rather than executing a giant scan. The AND-join also makes high-token gibberish match *fewer* rows, collapsing the N+1's N toward zero. For this small single-SQLite study app the absolute work is modest; the realistic abuse is generic request flooding, which is the F1 posture, not this query specifically.

**Evidence.**
```ts
const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);   // unbounded (index.ts:80)
const questionConditions = tokens.map(() => 'LOWER(q.question) LIKE ?').join(' AND ');
chapters.map((chapter) => { /* per-row re-query, index.ts:114-120 */ });
// chapters.ts:28-29 — input: z.object({ query: z.string() })  // no .max
```

**Remediation.** Add `.max(200)` to the query schema and slice tokens to a small N (e.g. 8) before building SQL. Replace the per-chapter inner loop with a single set-based query and add a `LIMIT` on returned chapters. FTS5 is optional given the data size.

---

### F5 — `[LOW]` Upstream Google/Azure TTS error bodies relayed verbatim to unauthenticated clients

**Location:** `apps/server/src/google-speech.ts:90-95` (`fetchAccessToken`), `:194-199` (`synthesizeChunk`); Azure path `apps/server/src/speech.ts:126-131`; surfaced via `packages/api/src/routers/speech.ts:24` + `packages/api/src/trpc.ts:56-67`
**CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information)

**Root cause.** Both providers interpolate the raw upstream response body (`await response.text()` / SDK `errorDetails`) into thrown `Error` messages. `speech.synthesize` awaits `ctx.speechService.synthesize` with no try/catch; the tRPC `errorFormatter` only adds `zodError` and never redacts `error.message`. In tRPC v11 a thrown non-`TRPCError` is wrapped as `INTERNAL_SERVER_ERROR` but its original `message` is preserved in the serialized response (only `stack` is gated behind `isDev`). So any unauthenticated caller can receive Google OAuth/IAM or Azure cancellation error bodies verbatim.

**Impact (low).** Disclosed data is **reconnaissance-grade only**: GCP project ID, service-account `client_email`, OAuth/IAM failure class (`invalid_grant`, clock skew, key disabled/expired, API disabled, quota exhausted), or Azure 401/throttle state and the hardcoded region (`germanywestcentral`). No bearer token, `private_key`, or data-plane secret is exposed. The leak only fires when the service account is in a *failure* state, and the identifiers leaked are themselves low-sensitivity.

**Evidence.**
```ts
const detail = await response.text();
throw new Error(`Google token exchange failed: ${response.status} ${response.statusText} - ${detail}`); // google-speech.ts:91-94
// speech.ts:126-131
reject(new Error(`Speech synthesis failed: ${errorDetails.reason} - ${errorDetails.errorDetails}`));
```

**Remediation.** Log the full upstream detail server-side; throw a generic `TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'TTS provider request failed' })`. Apply to both Google paths and the Azure `onResult`/`onError` paths. Better: a global tRPC error sanitizer in `errorFormatter` that replaces `message` for `INTERNAL_SERVER_ERROR` with a constant, so any future provider/DB error is opaque by default.

---

### F6 — `[LOW]` Foreign-key enforcement never enabled; `ON DELETE CASCADE` is inert

**Location:** `apps/server/src/db.ts:5` (connection open, no PRAGMA); FK declarations `migration.ts:55,65`; bare deletes `index.ts:50-53,155-156,245-246`
**CWE:** CWE-672 / data-integrity (orphaned records)

**Root cause.** The connection is opened via `new Database(dbDir + '/athena.db')` with no `PRAGMA foreign_keys = ON` anywhere in the codebase (grep returns nothing). SQLite defaults FK enforcement to **OFF per connection**, so the declared `ON DELETE CASCADE` clauses are inert. Delete repositories are bare single-table deletes with no compensating application cascade. Deleting a lecture orphans its chapters and (transitively) questions; deleting a chapter orphans its questions. `search()` `LEFT JOIN`s on chapters with no lecture-existence filter, so orphaned rows remain matchable.

**Impact (low → effectively a correctness/hygiene bug).** Under the no-auth threat model the "attacker" is just a normal user exercising the documented create/delete API. No privilege escalation, exfiltration, or auth bypass — only gradual unbounded local DB growth (orphans are less reclaimable) and search-result pollution. Track as a data-integrity/reliability bug, not a security risk score driver.

**Evidence.**
```ts
export const db: DatabaseType = new Database(dbDir + '/athena.db'); // no PRAGMA foreign_keys = ON
```

**Remediation.** Execute `db.pragma('foreign_keys = ON')` immediately after opening the connection in `db.ts`. Ship a one-time cleanup migration to purge already-orphaned chapters (`lectureId NOT IN lectures`) and questions (`chapterId NOT IN chapters`).

---

### F7 — `[LOW]` Supply-chain pinning: third-party actions and Docker base on mutable tags

**Location:** `.github/workflows/ci.yml` (`pnpm/action-setup@v6`, `docker/setup-buildx-action@v4`, `docker/build-push-action@v7`, `actions/*@v5/v6/v7`); `.github/workflows/deploy.yml:30,38,47` (docker/* on tags); `Dockerfile:2` (`FROM node:26-slim AS base`, reused at `:30`)
**CWE:** CWE-1357 (Reliance on Insufficiently Trustworthy Component)

**Root cause.** Every external GitHub Action is referenced by a floating major tag rather than a 40-char commit SHA, and the Docker base image is pinned only by the mutable tag `node:26-slim` (reused for the runner stage). Tags are mutable: a compromised action repo/maintainer or a silently re-pushed base image lands in the shipped artifact. `deploy.yml` runs on any tag push with `packages: write` `GITHUB_TOKEN` and `push: true` to GHCR, so the privileged chain is the higher concern; `ci.yml` is mitigated by `permissions: contents: read`, no secrets, `pull_request` (not `pull_request_target`), and `push: false`.

**Impact (low).** Requires an upstream compromise plus a tag re-point in the window between releases — outside Athena's control, no app-reachable input path. Dependabot is already configured for `github-actions` and `docker`, so pinned SHAs/digests would still be patched.

**Remediation.** Pin third-party actions to full commit SHAs with a trailing version comment (prioritize the privileged `deploy.yml` chain: `docker/login-action`, `docker/metadata-action`, `docker/build-push-action`, `pnpm/action-setup`). Pin the base image by digest: `FROM node:26-slim@sha256:<digest> AS base`. Let the existing Dependabot config bump both. Optionally add build provenance/SBOM attestation on the deploy `build-push-action`.

---

### F8 — `[LOW]` CI/CD hygiene: no dependency/secret/image scanning; floating `turbo`; unprotected GHCR publish

**Location:** `.github/workflows/ci.yml` / `deploy.yml` (no SCA/secret/image scan; `deploy.yml:6-9` `on: push: tags: ['*']` with no environment protection or concurrency); `package.json:21` (`"turbo": "latest"`)
**CWE:** CWE-1104 (Use of Unmaintained Third-Party Components), CWE-284 (Improper Access Control), CWE-1357

**Root cause.** Three related hygiene gaps grouped as defense-in-depth:
- **No scanning:** no `pnpm audit`, secret scan (gitleaks/trufflehog), image scan (trivy/grype), or SBOM anywhere in `.github/`; `deploy.yml` pushes to GHCR with no scan. Dependabot provides version-update PRs (and repo-level security alerts operate independently), partially covering the dependency-CVE path.
- **Floating `turbo`:** `"turbo": "latest"` in root `package.json` is non-deterministic in principle, but neutralized in practice — the lockfile pins `turbo@2.9.14`, all installs use `--frozen-lockfile` (`ci.yml:30/53/98`, `Dockerfile:24`), Dependabot mediates bumps, and `turbo` is excluded from `pnpm.onlyBuiltDependencies`, so its install scripts are blocked under pnpm 10's default-deny.
- **Unprotected release:** `deploy.yml` publishes to GHCR on *any* tag (`'*'`) with `packages: write` and no GitHub Environment / required reviewers / concurrency guard. Precondition is an already-trusted repo-write actor; this is governed by GitHub account/branch-protection controls, not the YAML.

**Impact (low/info).** All defense-in-depth / process-maturity items with no attacker-reachable code path in this app's threat model.

**Remediation.** Add a non-blocking `pnpm audit --prod` step and provenance/SBOM attestation on the deploy build; start a trivy scan non-blocking. Change `"turbo": "latest"` → `"^2.9.14"`. Restrict the deploy trigger to `v*`, add a `concurrency:` group, and optionally bind `build-and-push` to a protected Environment with required reviewers. Ensure repo-level Dependabot security alerts are enabled.

---

### F9 — `[INFO]` No HTTP security headers (no helmet / CSP / nosniff / frame-ancestors / HSTS)

**Location:** `apps/server/src/index.ts` main() (registers only cors + static + tRPC); static at `:315-318`
**CWE:** CWE-693 (Protection Mechanism Failure)

The server registers no `@fastify/helmet` and sets no security response headers (no dependency in `package.json`). The headline "missing CSP leaves stored-XSS uncontained" claim has **no underlying sink**: user content renders via `<ReactMarkdown>{...}</ReactMarkdown>` (e.g. `LectureLearn.tsx:419`, `TrainingSession.tsx:478`, `EditChapterModal.tsx:360`) with **no `rehype-raw`** and **no `dangerouslySetInnerHTML`/`innerHTML` anywhere** (react-markdown v10 escapes raw HTML by default). Clickjacking is moot — every mutation is already callable directly via the unauthenticated `origin: true` API, and there is no session to hijack. HSTS is inapplicable (plain HTTP on `:4000`, no TLS in this code). **Info / optional hardening.**

**Remediation.** Optionally register `@fastify/helmet` (`X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `default-src 'self'; connect-src 'self'; object-src 'none'`), HSTS only behind TLS. The substantive control is keeping the markdown path free of `rehype-raw`/`dangerouslySetInnerHTML`.

---

### F10 — `[INFO]` tRPC error formatter leaks stack traces outside production

**Location:** `packages/api/src/trpc.ts:56-67`
**CWE:** CWE-209

The `errorFormatter` spreads the raw default `shape`, carrying through `shape.data.stack`, which tRPC v11 populates whenever `NODE_ENV !== 'production'` (verified in `@trpc/server@11.17.0`). The shipped Docker image sets `NODE_ENV=production` (`Dockerfile:51`), so the container is unaffected; only a non-Docker run started without `NODE_ENV=production` (e.g. `node dist/index.js` or `pnpm dev`) leaks absolute paths/module names to unauthenticated callers. Given F1 already grants full CRUD, a stack trace adds negligible recon value. The `zodError.flatten()` portion leaks only field names/validation rules that are public in the OSS schema. **Info.**

**Remediation.** Explicitly delete `shape.data.stack` before returning (or pass `isDev: false`); document that non-Docker runs must set `NODE_ENV=production`.

---

### F11 — `[INFO]` Fastify default logger enabled in production with no redaction

**Location:** `apps/server/src/index.ts:280-282` (`Fastify({ logger: true })`)
**CWE:** CWE-532

Pino default request serialization logs method, URL, hostname, remoteAddress/port — **not** bodies or headers, so TTS credentials are not exposed. The residual is that tRPC GET-batched query inputs (search terms, lecture/chapter IDs) are serialized into the URL query string and thus written to logs (mutations are POST, body not logged). Low-sensitivity metadata, visible only to whoever can already read container stdout. **Info.**

**Remediation.** Set a production log level and a `serializers.req` that drops the query string from the logged URL; add a `redact` list (authorization, cookie) as forward-looking defense in depth.

---

### F12 — `[INFO]` Oversized stored rows & fully-buffered base64 audio (resource-exhaustion amplifiers)

**Location:** stored fields `questions.ts:32-33,44-45`, `lectures.ts:17-18,28-29`, `chapters.ts:36,47` (all `z.string()`, no `.max()`); audio buffering `apps/server/src/google-speech.ts:209-218` (`Buffer.concat` → base64), Azure `speech.ts:120`
**CWE:** CWE-770 / CWE-400

All free-text fields and the synthesized audio are unbounded/fully resident. An unauthenticated loop of large `createQuestion` rows grows the `/data` SQLite volume toward disk exhaustion, and synthesized MP3 is accumulated into `parts: Buffer[]`, `Buffer.concat`ed, base64-encoded (~1.33×), and held in the JSON response. Both are **bounded in practice**: Fastify's default ~1 MiB body cap limits a single request, synthesis is sequential and externally rate-limited by the cloud provider, and these are fully derivative of the F1 no-auth/no-rate-limit posture (an attacker can already fill disk with normal-sized rows). **Info / defense-in-depth.**

**Remediation.** Add reasonable `.max()` bounds to every stored/synthesized string field (titles/association a few hundred chars; question/answer/speech text a few KB), set an explicit smaller Fastify `bodyLimit`, optionally cap total audio bytes per request and set a container memory limit + `--max-old-space-size`. The real fix is F1 (auth/rate-limit) plus `/data` disk monitoring.

---

## 3. Prioritized Remediation Roadmap

Fix in this order; the first item is the single highest-leverage change and renders most lower items moot for untrusted callers.

1. **[F1 — do first] Add an authentication boundary.** Thread `req` into `createContext`, add `protectedProcedure`, gate all mutations + `speech.synthesize` behind a shared secret / bearer token (skip-when-unset for local dev with a startup warning). Default-bind to `127.0.0.1`.
2. **[F2 — do alongside F1] Bound the TTS input.** Add `text: z.string().min(1).max(5000)` in `speech.ts` — collapses the ~200× billable fan-out independently of auth. Add `@fastify/rate-limit` on `synthesize` and an outbound daily budget for exposed deployments.
3. **[F3] Lock down CORS.** Set `origin: false` (SPA is same-origin) or an explicit env allowlist; never ship `origin: true` to a network-exposed deployment.
4. **[F12 / F4] Input caps everywhere.** `.max()` on all stored string fields and the search query; slice search tokens to N≈8; lower Fastify `bodyLimit`; set `requestTimeout`/`connectionTimeout`.
5. **[F4] Fix the search N+1.** Replace the per-chapter inner query with a single set-based query; add `LIMIT`.
6. **[F5] Sanitize provider errors.** Log upstream bodies server-side; return opaque `TRPCError`s (global sanitizer in `errorFormatter`).
7. **[F6] Enable FK enforcement.** `db.pragma('foreign_keys = ON')` + one-time orphan-cleanup migration. (Data-integrity track.)
8. **[F7/F8] Supply-chain hardening.** Pin actions to SHAs and base image to digest; add `pnpm audit` + image scan + SBOM/provenance; pin `turbo` to `^2.9.14`; restrict deploy trigger to `v*` with concurrency + protected environment.
9. **[F9/F10/F11] Hardening pass.** Register `@fastify/helmet`; strip `stack` from the error shape; configure pino redaction/level and drop query strings from logs.

---

## 4. Appendix: Checked-but-Not-Confirmed

Items investigated and **refuted, downgraded, or confirmed-as-negative-results** — listed so the reader knows they were verified.

| Item | File | Verdict | One-line rationale |
|------|------|---------|--------------------|
| Unescaped LIKE wildcards → query-semantics manipulation | `index.ts` | Refuted | Real mechanism, but self-targeted on a single-user no-auth app; no trust boundary crossed. Parameters are correctly bound. |
| `DB_PATH` string-concat path build | `db.ts` | Refuted | `DB_PATH` is operator config (Dockerfile/turbo.json only), never request-controlled; at worst a cosmetic double-slash. |
| SQL injection in dynamic search query | `index.ts` | Refuted (verified safe) | `tokens.map()` emits only constant `?` placeholders; all token data passed as bound params; identifiers are hardcoded. |
| Client forces SSML / injects `[pause]` markers into Google markup | `google-speech.ts` | Refuted | Self-targeted output-pacing quirk; Google path has no server-owned envelope to break out of; decoded entities are inert literal text. |
| Allowed SSML tags accept arbitrary attributes | `speech.ts` | Refuted | Allowed tags (emphasis/prosody/break) define no URL/scripting attrs; Azure ignores unknown attrs; all resource/envelope tags blocked. Forward-looking only. |
| Mass-assignment via `...input` spread reparents records | `index.ts` | Duplicate | Every mutation Zod-whitelists fields and strips `id`; `updateChapter` doesn't accept `lectureId`; `moveChapter` reparenting is intended. Derivative of F1. |
| Static serving / SPA fallback path traversal | `index.ts` | Refuted | `@fastify/send` rejects `..` with 403; root is the Vite build only; `sendFile('index.html')` is a constant. `dotfiles:'allow'` default leaks nothing of value. |
| Vite dev server binds `0.0.0.0`, proxies `/api` | `vite.config.ts` | Refuted | Backend already binds `0.0.0.0:4000` itself with no auth; Vite is a narrower path to an already-exposed API. Vite pinned to `^8`. |
| SA JSON / `SPEECH_KEY_FILE` path echoed in startup logs | `google-speech.ts` | Confirmed (negligible) | Only the operator-set filesystem **path** + ENOENT/EACCES logged; no key value or token. Folded into F11/F5 hygiene. |
| No hardcoded secrets; secrets excluded from image | `Dockerfile` | Confirmed (negative) | `.dockerignore`/`.gitignore` exclude `.env*`/`athena.db`; runner stage copies only build output; `SPEECH_REGION` is a region constant; grep finds no committed secrets. |
| No CSP on app rendering attacker content | `index.html` | Refuted | No XSS sink — `<ReactMarkdown>` without `rehype-raw`/`dangerouslySetInnerHTML`; payloads render inert. See F9. |
| Blob object URL leaked when `audio.play()` rejects | `SpeechPlayButton.tsx` | Refuted | Real client-side leak of the user's *own* audio; no confidentiality/integrity boundary; reclaimed on reload. Code-quality nit. |
| postinstall RCE surface minimized via `onlyBuiltDependencies` | `package.json` | Confirmed (positive control) | pnpm 10 default-deny + 3-package allowlist + sha512-only lockfile correctly minimize install-time RCE. Documented so the allowlist isn't broadened. |