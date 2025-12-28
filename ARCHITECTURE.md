# **Project Architecture: Monorepo React + tRPC**

This document outlines the architectural design, directory structure, and technical stack for the application. The project is managed as a **pnpm + Turbo** monorepo containing both the frontend and backend logic, along with shared packages.

## **1. Technical Stack**

| Component           | Technology | Version | Description                                          |
| :------------------ | :--------- | :------ | :--------------------------------------------------- |
| **Language**        | TypeScript | v5.x    | Unified language for typical Full Stack type-safety. |
| **Package Manager** | pnpm       | v9.0.x  | Fast, disk-efficient package manager.                |
| **Monorepo**        | Turborepo  | latest  | High-performance build system.                       |
| **Frontend**        | React      | v18.2.x | UI library using functional components and hooks.    |
| **Build Tooling**   | Vite       | v5.x    | Fast frontend build tool.                            |
| **Backend**         | Fastify    | v4.26.x | Low overhead web framework for Node.js.              |
| **Communication**   | tRPC       | v10.x   | End-to-end typesafe APIs.                            |
| **Database**        | SQLite     | Latest  | (Planned) Lightweight relational database.           |
| **Formatting**      | Prettier   | v3.x    | Opinionated code formatter.                          |

## **2. Repository Structure**

The repository is organized into `apps` (deployable applications) and `packages` (shared internal libraries).

```text
.
├── apps/
│   ├── web/          # Frontend application (Vite + React)
│   └── server/       # Backend server (Fastify + tRPC)
├── packages/
│   ├── api/          # Shared tRPC router and procedure definitions
│   └── typescript-config/ # Shared TSConfig bases
├── package.json      # Root manifest (Workspaces + Turbo config)
├── pnpm-workspace.yaml # Monorepo workspace definition
└── turbo.json        # Pipeline configuration
```

### **2.1 Apps**

- **web**: A Single Page Application (SPA) built with Vite and React. It consumes the backing API via the tRPC React Query client.
- **server**: A Node.js server using Fastify. It hosts the tRPC router defined in `@athena/api` and handles database interactions.

### **2.2 Packages**

- **api**: Contains the `appRouter` definition, Zod schemas, and context creators. This is imported by `server` (to implement) and `web` (to consume types), ensuring perfect type synchronization.
- **typescript-config**: Centralized `tsconfig.json` files to ensure consistent compiler options across the monorepo.

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
- **Location**: A dedicated `e2e` folder or within `apps/web`.

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
