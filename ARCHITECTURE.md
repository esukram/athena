# **Project Architecture: Monorepo React \+ tRPC**

This document outlines the architectural design, directory structure, and technical stack for the application. The project is managed as a monorepo containing both the frontend and backend logic within a unified TypeScript environment.

## **1\. Technical Stack**

| Component | Technology | Version |
| :---- | :---- | :---- |
| **Package Manager** | npm | v10+ (Stable) |
| **Language** | TypeScript | v5.7.2 (Stable) |
| **Build Tooling** | Vite | v6.0.5 (Stable) |
| **Frontend Framework** | React | v19.0.0 (Stable) |
| **Communication** | tRPC | v10.45.2 (Latest Stable) |
| **Database** | SQLite | Latest (Stable) |
| **Formatting** | Prettier | v3.4.2 (Stable) |
| **Testing** | Vitest | v2.1.8 (Stable) |
| **UI Library** | @material/web | v2.4.1 (Stable) |

## **2\. Directory Structure**

The project follows a strict monorepo layout within the src directory to maintain clear boundaries between the client and server codebases.

.  
├── src/  
│   ├── backend/  
│   │   ├── dao/             \# Data Access Objects for SQLite interaction  
│   │   ├── routers/         \# tRPC router definitions  
│   │   ├── tests/           \# Dedicated backend unit and integration tests  
│   │   ├── context.ts       \# tRPC context (Auth, DB instances)  
│   │   └── index.ts         \# Server entry point  
│   ├── frontend/  
│   │   ├── components/      \# UI components  
│   │   ├── hooks/           \# Dedicated custom React hooks  
│   │   ├── tests/           \# Frontend unit and component tests (Vitest/RTL)  
│   │   ├── utils/           \# tRPC client and helpers  
│   │   ├── App.tsx          \# Main application entry  
│   │   └── main.tsx         \# Vite entry point  
│   └── shared/              \# Shared TypeScript types (tRPC router types)  
├── package.json             \# Root package.json (npm workspaces)  
├── vite.config.ts           \# Vite configuration  
├── tsconfig.json            \# Base TypeScript configuration  
└── .prettierrc              \# Prettier formatting rules

## **3\. Package Management (npm)**

The project uses **npm** for dependency management and workspace orchestration.

* **Workspaces:** The monorepo utilizes npm workspaces defined in the root package.json to manage cross-package dependencies (e.g., frontend importing types from backend/shared).  
* **Scripts:** Standardized scripts are provided at the root for npm install, npm run dev, and npm run build to execute commands across the workspace.

## **4\. Communication Layer (tRPC)**

The application uses **tRPC v10** (Stable) to provide end-to-end typesafe APIs.

* **Contract-First:** The backend defines the AppRouter type, which is imported by the frontend to provide full autocomplete and type-checking for API calls.  
* **Procedures:** All logic is organized into queries (reads) and mutations (writes).  
* **Validation:** Inputs are validated using Zod (Stable) to ensure runtime safety alongside TypeScript's compile-time safety.

## **5\. Backend & Data Access (DAO Layer)**

To maintain a clean separation of concerns, the backend utilizes a **DAO (Data Access Object) Pattern**.

1. **SQLite Database:** Persistent storage using a local .db file.  
2. **DAO Layer (src/backend/dao/):** These classes/functions are the only parts of the application that interact directly with the database. They encapsulate SQL queries and return clean TypeScript objects.  
3. **tRPC Routers:** The procedures in the routers call methods on the DAOs. They do not write raw SQL or interact with the database driver directly.

## **6\. Frontend Architecture**

* **Vite:** Used for rapid development and optimized production builds.  
* **Custom Hooks (src/frontend/hooks/):** Complex logic, state management, and tRPC query wrappers are extracted into dedicated hooks to keep components lean and presentational.  
* **State Management:** Managed primarily through @trpc/react-query, leveraging TanStack Query v5 (Stable) for caching, synchronization, and server-state management.

## **7\. Testing Strategy**

* **Backend Tests (src/backend/tests):** Focused on DAO logic and tRPC procedure integration using Vitest. Databases are mocked or pointed to an in-memory SQLite instance for speed.  
* **Frontend Tests (src/frontend/tests):** Focused on component rendering and hook logic using Vitest and React Testing Library.

## **8\. Development Guidelines**

* **Formatting:** Prettier is enforced across the repository to ensure consistent code style.  
* **Type Safety:** any is strictly discouraged. Leverage tRPC's inferred types for all data-fetching operations.  
* **Building:** Run npm run build to generate the frontend assets and compile the TypeScript backend.