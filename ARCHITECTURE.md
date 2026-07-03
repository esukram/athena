# **Project Architecture: Monorepo React + tRPC**

This document outlines the architectural design, directory structure, and technical stack for the application. The project is managed as a **pnpm + Turbo** monorepo containing both the frontend and backend logic, along with shared packages.

## **1. Technical Stack**

| Component           | Technology | Version | Description                                          |
| :------------------ | :--------- | :------ | :--------------------------------------------------- |
| **Language**        | TypeScript | v5.9.x   | Unified language for typical Full Stack type-safety.            |
| **Package Manager** | pnpm       | v10.26.x | Fast, disk-efficient package manager.                           |
| **Monorepo**        | Turborepo  | latest   | High-performance build system.                                  |
| **Frontend**        | React      | v19.2.x  | UI library using functional components and hooks.               |
| **Build Tooling**   | Vite       | v8.x     | Fast frontend build tool.                                       |
| **Backend**         | Fastify    | v5.8.x   | Low overhead web framework for Node.js.                         |
| **Communication**   | tRPC       | v11.x    | End-to-end typesafe APIs.                                       |
| **Database**        | SQLite     | v12.8.x  | Lightweight relational database, via `better-sqlite3`.          |
| **Speech**          | Pluggable  | —        | TTS provider selected via `TTS_PROVIDER` env var: Azure Cognitive Services SDK (SSML) or Google Cloud TTS REST (Chirp3-HD). |
| **i18n**            | i18next    | v26.x    | UI translation framework (English + German with auto-detection).|
| **Formatting**      | Prettier   | v3.x     | Opinionated code formatter.                                     |

## **2. Repository Structure**

The repository is organized into `apps` (deployable applications) and `packages` (shared internal libraries).

```text
.
├── apps/
│   ├── web/          # Frontend application (Vite + React)
│   └── server/       # Backend server (Fastify + tRPC)
├── packages/
│   ├── domain/       # Application & domain tier (entities, use cases, ports) — zero runtime deps
│   ├── api/          # Shared tRPC router and procedure definitions
│   ├── eslint-config/ # Shared ESLint config
│   └── typescript-config/ # Shared TSConfig bases
├── package.json      # Root manifest (Workspaces + Turbo config)
├── pnpm-workspace.yaml # Monorepo workspace definition
└── turbo.json        # Pipeline configuration
```

### **2.1 Apps**

- **web**: A Single Page Application (SPA) built with Vite and React. It consumes the backing API via the tRPC React Query client.
- **server**: A Node.js server using Fastify. It hosts the tRPC router defined in `@athena/api` and handles database interactions.

### **2.2 Packages**

- **domain**: The application & domain tier. Pure TypeScript with **zero runtime dependencies**: entities, value objects, repository ports, read-model query ports, the `UnitOfWork` transactional boundary, typed domain errors, and use cases — organised by bounded context (`curriculum`, `training`, `speech`). Both `api` (presentation) and `server` (infrastructure) depend on it; it depends on neither.
- **api**: Contains the `appRouter` definition, Zod schemas, and context creators. Routers are thin adapters: they parse input, call one domain use case, and let the error-mapping middleware translate domain errors to tRPC codes. Imported by `server` (to implement) and `web` (to consume types), ensuring perfect type synchronization.
- **eslint-config**: Shared ESLint flat-config presets consumed by every workspace.
- **typescript-config**: Centralized `tsconfig.json` files to ensure consistent compiler options across the monorepo.

### **2.3 Layered Architecture & Bounded Contexts**

The codebase follows a three-tier layering with the dependency direction
**presentation → application/domain ← infrastructure**:

```text
Tier 1 — Presentation     apps/web (React) + packages/api routers (thin tRPC adapters)
Tier 2 — Application/Domain  packages/domain (entities, value objects, use cases, ports)
Tier 3 — Infrastructure   apps/server (SQLite repositories & queries, transactions,
                          migrations, TTS adapters, Fastify host, composition root)
```

The domain tier is split into three **bounded contexts**:

- **Curriculum** (authoring): lectures, chapters, questions, ordering, search, and the
  read-model queries behind the overview/edit screens. The _Lecture_ is the aggregate
  root that owns chapter membership and contiguous chapter ordering.
- **Training** (studying): session sequencing, chapter ordering (annotated-first /
  shuffle), progress measurement, and previous/next navigation rules.
- **Speech**: TTS text-preparation vocabulary (`verbalizeSymbols`), the `SpeechService`
  port, and the speakable `LanguageCode`. Concrete Azure/Google adapters live in `server`.

**Dependency rule (enforced by ESLint).** `packages/domain` must not import from
`@athena/api`, `apps/*`, or any infrastructure/UI library (`@trpc/*`, `better-sqlite3`,
`fastify`, `react`, `zod`, …); `packages/api` must not import infrastructure
(`better-sqlite3`, `fastify`). These `no-restricted-imports` rules keep the arrows
pointing inward so the layering can't silently erode.

### **2.4 Glossary (Ubiquitous Language)**

Use these terms — in code, comments, and UI copy — for the core concepts. When a new
concept enters the code, give it its glossary name rather than an improvised one.

| Term         | Meaning                                                                                  | Notes |
| :----------- | :--------------------------------------------------------------------------------------- | :---- |
| **Lecture**  | A course / top-level study unit. Aggregate root of the Curriculum context.               | The README's "Course" is the same concept; code uses _Lecture_. |
| **Chapter**  | An ordered group of questions within a lecture. Has no title of its own.                 | Identified in the UI by its first question. |
| **Question** | A single flash card (a question/answer pair) within a chapter. Also called an _Index Card_ in the UI. | Code term: _Question_. |
| **Tag**      | A free-text category/label on a chapter (README: "associations (categories)").           | ⚠️ Stored and transported under the **legacy** field name `association`; a physical rename to `tag` is a planned follow-up (see findings D3). Treat `association` as the persistence-level alias of _Tag_. |
| **Order**    | The 0-based contiguous position of a chapter in its lecture, or a question in its chapter. | Modelled by the `OrderIndex` value object. |
| **Annotated**| A question the learner flagged to revisit; surfaces its chapter first in regular training. | |

## **3. UI Design Guidelines**

The application UI is built with Tailwind CSS. Use design tokens by adding custom styles to the theme.

### **3.1 Principles**

- **Tokens**: Utilize Tailwind CSS design tokens for colors and spacing to ensure consistency (e.g., `primary`, `on-surface`, `container`).
- **Responsive**: Designs must work on Mobile, Tablet, and Desktop, utilizing standard Tailwind breakpoints.

## **4. Testing Strategy**

Testing is a critical part of the architecture and should follow this split:

### **4.1 Unit & Integration Testing (Vitest)**

- **Tool**: [Vitest](https://vitest.dev/) (fast, Vite-native).
- **Scope**:
  - Shared logic in `packages/`.
  - Individual React components in `apps/web`.
  - Backend helper functions in `apps/server`.
- **Location**: Test files should be co-located with source files (e.g., `Button.test.tsx` next to `Button.tsx`).

### **4.2 End-to-End (E2E) Testing (Playwright)**

- **Tool**: [Playwright](https://playwright.dev/).
- **Scope**: Critical user journeys (Login, Data submission, etc.).
- **Location**: `apps/web/tests/`.
- **Run**: `pnpm test:e2e` (root) or `pnpm --filter web test:e2e`.

## **5. Development Workflow**

### **5.1 Setup**

1. Install dependencies: `pnpm install`
2. Start development mode: `pnpm dev`
   - This starts both `apps/web` (Vite) and `apps/server` (Fastify) in parallel via Turbo.

### **5.2 Adding Features**

1. **Define Schema**: Update `@athena/api` with new Input/Output Zod schemas.
2. **Implement Procedure**: Add the procedure to the tRPC router in `@athena/api`.
3. **Backend Logic**: Implement the resolver logic, connecting to the database if needed.
4. **Frontend UI**: Create React components consuming the new tRPC query/mutation.
5. **Verify**: Ensure types flow through and everything compiles.
