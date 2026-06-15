# Architecture Review — Findings

**Scope:** Full review of the Athena monorepo (`apps/web`, `apps/server`, `packages/api`) against two target qualities:

1. A clean **three-tier architecture** (presentation → application/domain → data access).
2. **Domain-Driven Design** (ubiquitous language, explicit domain model, aggregates, ports & adapters).

**Date:** 2026-06-09

---

## 1. Executive Summary

The codebase is in good shape for its size: it already has a repository abstraction with dependency inversion (interfaces in `packages/api`, SQLite implementations in `apps/server`), thin-ish routers, end-to-end type safety via tRPC, and a pluggable TTS adapter. The structural foundation for a three-tier architecture exists.

The main gap is that **there is no application/domain tier**. Business rules currently live in two wrong places: inside tRPC routers (transport layer) and inside React components (presentation layer). The domain model is anemic — `packages/api/src/types.ts` contains plain data shapes with no invariants. There are also **no transactional boundaries**, so multi-step mutations (chapter reorder/move) can leave data inconsistent if they fail midway.

None of the findings require a rewrite. The recommended path is an incremental extraction of a domain/application layer (Section 5), which the existing repository interfaces make straightforward.

---

## 2. Current Architecture (As-Is)

```text
┌────────────────────────────────────────────────────────────┐
│  apps/web (React SPA)                                      │
│  pages/, components/, hooks/, utils/                       │
│  – consumes tRPC via React Query                           │
│  – contains training-session & speech-preprocessing logic  │
└──────────────────────────┬─────────────────────────────────┘
                           │ tRPC over HTTP
┌──────────────────────────▼─────────────────────────────────┐
│  packages/api (@athena/api)                                │
│  routers/ (lectures, chapters, questions, speech)          │
│  – Zod validation ✓                                        │
│  – BUT: business logic inline in routers                   │
│  trpc.ts – tRPC init + repository INTERFACES (mixed)       │
│  types.ts – anemic data shapes                             │
└──────────────────────────┬─────────────────────────────────┘
                           │ repository interfaces (DI ✓)
┌──────────────────────────▼─────────────────────────────────┐
│  apps/server                                               │
│  repositories.ts – SQLite implementations                  │
│  db.ts, migration.ts – better-sqlite3                      │
│  speech.ts / google-speech.ts / tts-provider.ts – adapters │
│  index.ts – Fastify host + composition root ✓              │
└────────────────────────────────────────────────────────────┘
```

What already works well:

- **Dependency inversion:** repository ports are defined upstream (`packages/api/src/trpc.ts:13-47`) and implemented downstream (`apps/server/src/repositories.ts`); the composition root in `apps/server/src/index.ts:34-49` wires them in. This is the hardest part of a layered migration and it's already done.
- **Adapter pattern for TTS:** `apps/server/src/tts-provider.ts` selects Azure/Google implementations behind the `SpeechService` port.
- **Input validation at the boundary** with Zod on every procedure.
- **Schema migrations** with versioning (`apps/server/src/migration.ts`).

---

## 3. Findings — Three-Tier Architecture

### F1 (High) — Business logic lives in the transport layer

The tRPC routers are not thin adapters; they implement domain rules directly:

- `packages/api/src/routers/chapters.ts:6-16` — `normalizeChapterOrders` (the "chapter order is contiguous" invariant) is a free function in a router file.
- `chapters.ts:65-97` (`moveChapter`) — computes target ordering, moves the chapter, renormalizes the source lecture. This is a use case, not transport code.
- `chapters.ts:98-145` (`reorderChapter`) — full reorder algorithm (shift up/down) inline in the procedure.

**Impact:** the rules can only be exercised through tRPC, can't be unit-tested in isolation, and will be duplicated as soon as a second entry point (CLI import, batch job, REST) appears.

**Recommendation:** introduce application services (use cases) — e.g. `ReorderChapter`, `MoveChapterToLecture` — that routers merely call. Routers keep: input parsing (Zod), calling one use case, mapping errors.

### F2 (High) — No transactional boundaries (unit of work)

There is not a single `db.transaction(...)` in the server. Multi-write operations execute as independent statements:

- `reorderChapter` issues one `UPDATE` per shifted chapter plus one for the target. A crash midway leaves duplicate/gapped order values.
- `moveChapter` updates the chapter, then renormalizes the source lecture in separate writes.
- `runMigrations` (`apps/server/src/migration.ts:112-116`) runs each migration and its version bump unwrapped — a failing migration leaves the schema half-applied with the version not advanced, and rerunning may not be idempotent (e.g. migration 2's `ALTER TABLE`).

**Impact:** data integrity depends on nothing ever failing mid-mutation. Migration 4 exists precisely to repair order gaps that this class of bug produces.

**Recommendation:** the application-service layer (F1) is the natural transaction owner. better-sqlite3's synchronous `db.transaction()` makes this cheap. Wrap each migration + version bump in a transaction too.

### F3 (Medium) — Layer boundaries are smeared inside `packages/api`

`packages/api/src/trpc.ts` mixes three concerns in one file: tRPC initialization (infrastructure), repository port definitions (domain contracts), and `AppContext` (composition). Similarly, `speakable-text.ts` (speech domain logic) sits next to transport code.

**Impact:** the domain contracts physically depend on `@trpc/server` and `zod` imports they don't need; nothing stops a router from importing `better-sqlite3` types tomorrow because there's no package boundary enforcing the direction of dependencies.

**Recommendation:** split into a dedicated `packages/domain` (or `packages/core`): entities, value objects, repository ports, domain errors, use cases — with **zero runtime dependencies**. `packages/api` then depends on `domain`; `apps/server` implements `domain` ports. Add an ESLint `no-restricted-imports`/dependency-cruiser rule to enforce direction.

### F4 (Medium) — Business logic in the presentation tier

- `apps/web/src/pages/LectureEdit.tsx` (904 lines) and `apps/web/src/components/TrainingSession.tsx` (674 lines, 13+ state hooks) interleave UI rendering with session sequencing, ordering and progress rules.
- `apps/web/src/utils/markdownToSsml.ts` performs speech text preprocessing client-side, while `verbalizeSymbols` does the text-format half server-side (`packages/api/src/routers/speech.ts:20-24`). The same concern (preparing text for TTS) is split across two tiers, with the split documented only in a comment.

**Impact:** training/progress rules can't be reused (e.g. for a future "progress tracking" backend feature, which the README already promises) and the SSML/text asymmetry is a trap for the next contributor.

**Recommendation:** extract training-session logic into plain TypeScript (custom hooks delegating to pure functions, or move it into the domain package since the web app already imports `@athena/api`). Consolidate speech preprocessing on the server side behind the `synthesize` procedure.

### F5 (Low) — Repository interfaces accumulating read-model methods

`QuestionRepository` carries query-shaped methods (`getFirstByLectureId`, `getQuestionCountsPerChapter`, `getAnnotatedChapterIdsByLecture`) alongside CRUD, and `ChapterRepository.search` returns an ad-hoc shape (`Chapter & { firstQuestion?: Question }`). `ChapterRepository.search` also runs N+1 queries (one per matched chapter, `apps/server/src/repositories.ts:112-130`).

**Recommendation:** separate **read models / query services** (e.g. `LectureOverviewQuery`, `ChapterSearchQuery` returning explicit DTOs) from repositories, which then shrink to aggregate persistence. This is CQRS-lite — no event sourcing implied.

### F6 (Low) — Infrastructure nits

- `apps/server/src/db.ts` builds the path by string concatenation (`dbDir + '/athena.db'`) instead of `path.join`, and opens the DB as a module side effect — fine today, but it prevents injecting a test database without module mocking (the repo's own tests work around this by constructing in-memory DBs directly).
- Errors are thrown as bare `new Error('Chapter not found')` (`chapters.ts:74`), surfacing as `INTERNAL_SERVER_ERROR` instead of a typed `NOT_FOUND`.
- Update semantics are inconsistent: lectures require a full replacement object, chapters/questions accept partials.

---

## 4. Findings — Domain-Driven Design

### D1 (High) — Anemic domain model, no invariants

`packages/api/src/types.ts` defines pure data shapes. All invariants are implicit and enforced (or not) at scattered points:

| Invariant | Where it lives today |
| :-- | :-- |
| Chapter order is contiguous per lecture | `normalizeChapterOrders` in a router + repair migration 4 |
| Question order is contiguous per chapter | Nowhere (client sends `order`) |
| A question belongs to exactly one chapter | FK constraint only |
| Lecture title/description non-empty | Zod schema in router only |

**Recommendation:** model `Lecture`, `Chapter`, `Question` as entities whose mutation methods uphold their own invariants, with value objects where they pay off (`OrderIndex`, `Association`, `LanguageCode` for `'de' | 'en'` which is currently re-declared in three places).

### D2 (High) — No aggregate boundaries

Ordering is the giveaway: "chapters within a lecture have contiguous order" is an invariant spanning multiple rows, which is exactly what an aggregate is for. Today any caller can `chapterRepository.update(id, { order: 7 })` and break it.

**Recommended aggregates:**

- **Lecture** (root) — owns chapter membership and chapter ordering. `moveChapter`/`reorderChapter` become operations on the Lecture aggregate, transactional by construction.
- **Chapter** (root) — owns its questions and question ordering.
- Repositories then load/save aggregates rather than exposing raw row updates.

### D3 (Medium) — Ubiquitous language is inconsistent

- README says **Course / Lecture** and **Index Card**; code says `Lecture` and `Question`. Pick one term per concept and use it everywhere (suggest: *Lecture*, *Chapter*, *Card* or *Question* — decide once).
- `Chapter.association` is the most misleading name in the codebase: it actually means *category/tag* (README: "Tag chapters with associations (categories)"). A chapter also has no title — the UI identifies it by its first question, which is why repositories grow `getFirstByChapterId`-style methods. Naming the concept properly (e.g. `tag` or `category`, and possibly an explicit chapter `title`) would simplify both model and queries.
- Maintain a short glossary in `ARCHITECTURE.md` as the language is settled.

### D4 (Medium) — Bounded contexts exist implicitly; make them explicit

Three contexts are visible in the code and should be named, even while staying in one deployable:

1. **Curriculum** (authoring): lectures, chapters, questions, ordering, search.
2. **Training** (studying): session flow, shuffle, auto-advance, progress — currently trapped inside React components (F4); the README's "Progress Tracking" feature will need this on the server.
3. **Speech**: TTS synthesis, text verbalization, voice/language selection — already half-extracted via `SpeechService`; finish it by moving `speakable-text.ts` and `markdownToSsml.ts` into one module owned by this context.

Organize the domain package by context (`domain/curriculum`, `domain/training`, `domain/speech`) rather than by technical kind.

---

## 5. Target Architecture (To-Be) and Migration Plan

```text
Tier 1 — Presentation
  apps/web (React: rendering, routing, i18n, hooks calling use cases via tRPC)
  packages/api routers (thin tRPC adapters: Zod parse → use case → error map)

Tier 2 — Application & Domain        ← NEW: packages/domain
  curriculum/  entities, value objects, use cases (ReorderChapter, MoveChapter, …)
  training/    session/progress rules (extracted from TrainingSession.tsx)
  speech/      text verbalization + SpeechService port
  ports: LectureRepository, ChapterRepository, QuestionRepository,
         read-model queries, UnitOfWork

Tier 3 — Data Access & Infrastructure
  apps/server: SQLite repository adapters, transactions, migrations,
               Azure/Google TTS adapters, Fastify host, composition root
```

Incremental, low-risk order of work (each step ships independently):

1. **Create `packages/domain`** and move `types.ts` + the repository interfaces out of `trpc.ts`. Pure re-exports keep `@athena/api`'s public API unchanged. *(F3)*
2. **Extract use cases** from `chapters.ts` (`reorderChapter`, `moveChapter`, `deleteChapter` + normalization) into application services with unit tests; routers become one-liners. *(F1, D1)*
3. **Add a UnitOfWork port** implemented with `db.transaction()`; wrap the extracted use cases and each migration. *(F2)*
4. **Introduce typed domain errors** (`ChapterNotFound`, …) and map them to `TRPCError` codes in one place. *(F6)*
5. **Split read models from repositories** for the count/search/first-question queries; fix the search N+1 while doing it. *(F5)*
6. **Extract training logic** from `TrainingSession.tsx`/`LectureEdit.tsx` into pure functions + hooks. *(F4)*
7. **Settle the ubiquitous language** (rename `association`, decide Card vs. Question), add a glossary to `ARCHITECTURE.md`, and add a lint rule enforcing layer-dependency direction. *(D3, F3)*

Steps 1–4 are the substance; 5–7 are follow-ups that can ride along with feature work.

---

## 6. Definition of Done for the Architecture

Going forward, a change conforms to the target architecture when:

- Routers contain no conditionals beyond input parsing and error mapping.
- Every multi-write mutation runs inside a single transaction.
- Domain rules are unit-testable without tRPC, Fastify, or SQLite.
- `packages/domain` has no runtime dependencies; dependency direction is presentation → application/domain ← infrastructure, enforced by lint.
- New concepts enter the code with the glossary name, not an improvised one.

---

## 7. Resolution Log

Status of each finding after the architecture-refactor work.

| ID | Status | What was done |
| :-- | :-- | :-- |
| **F1** — logic in transport | ✅ Done | Chapter reorder/move/delete extracted into `@athena/domain` use cases; routers are thin adapters. |
| **F2** — no transactions | ✅ Done | `UnitOfWork` port + better-sqlite3 `db.transaction()`; use cases and each migration+version bump wrapped. Commit/rollback covered by tests. |
| **F3** — smeared boundaries | ✅ Done | New `packages/domain` (zero runtime deps) holds types, ports, errors, use cases. ESLint `no-restricted-imports` enforces dependency direction in `domain` and `api`. |
| **F4** — logic in presentation | ◑ Substantially done | Training ordering/progress/search/sequencing rules extracted to the `training` context and unit-tested; `TrainingSession.tsx` consumes them. Speech symbol-verbalization unified in the `speech` context. The markdown→SSML _rendering_ stays client-side on purpose (the playback hook needs a synchronous speakability gate); a full server relocation is a deferred follow-up. `LectureEdit.tsx` decomposition not attempted (large, low-risk-to-leave). |
| **F5** — read models / N+1 | ✅ Done | Read-model query ports (`LectureOverviewQuery`, `ChapterSearchQuery`, `QuestionStatsQuery`) split from repositories; search N+1 replaced with three bounded queries. |
| **F6** — infra nits | ✅ Done | `createDatabase()` factory with `path.join`, no import-time side effect; typed domain errors mapped to tRPC codes (NOT_FOUND / BAD_REQUEST) in one middleware; lecture updates accept partials. |
| **D1** — anemic model | ✅ Done | Chapter-ordering invariant owned by the Lecture aggregate; `OrderIndex` and `LanguageCode` value objects; typed domain errors. |
| **D2** — no aggregates | ✅ Done | Lecture aggregate owns contiguous chapter ordering; ordering operations are pure functions persisted transactionally. |
| **D3** — ubiquitous language | ◑ Documented + deferred rename | Glossary added to `ARCHITECTURE.md` settling the vocabulary (Lecture / Chapter / Question / **Tag**). The physical `association → tag` rename (DB column + wire contract + UI + e2e specs) is deliberately deferred as a follow-up to avoid a wire-breaking change; `association` is recorded as the persistence-level alias of _Tag_. |
| **D4** — implicit contexts | ✅ Done | `domain` is organised by bounded context (`curriculum`, `training`, `speech`); contexts documented in `ARCHITECTURE.md`. |
