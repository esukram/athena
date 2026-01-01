# Contributing to Athena 🦉

Thank you for your interest in contributing to Athena! We welcome all contributions, whether it's fixing a bug, adding a new feature, or improving documentation.

## 🚀 Getting Started

Before you start, please ensure you have read the [README.md](README.md) for installation and setup instructions.

### Prerequisites

- **Node.js**: v18 or higher
- **pnpm**: v9 or higher
- **GitHub CLI**: (Optional, but recommended)

## 🛠️ Development Workflow

1.  **Select an Issue**: Choose an existing issue or create a new one to discuss your proposed changes.
2.  **Create a Branch**: Create a new branch for your work.

```bash
git checkout -b feat/your-feature-name
```

3.  **Implement Changes**: Follow our [Coding Standards](#-coding-standards).
4.  **Add Tests**: Ensure your changes are covered by [E2E tests](#-testing-policy).
5.  **Submit a PR**: Create a Pull Request with a clear description and link to any relevant issues.

## 🎨 Coding Standards

To maintain high code quality and consistency, we follow these guidelines:

### React Components

- **Composable**: Build small, reusable, and single-purpose components. Favor composition over large, complex components.
- **Functional Components**: Use functional components with React Hooks.
- **Styling**: We use **Tailwind CSS**. Follow the established design tokens and utility classes.
- **Accessibility**: Ensure all components are accessible (semantic HTML, ARIA labels, keyboard navigation).
- **I18n**: Never hardcode strings. Use the translation system (i18next). Support both **English (en)** and **German (de)**.

### TypeScript

- **Static Typing**: Use TypeScript for all files. Avoid `any` where possible.
- **Type Safety**: Leverage tRPC for end-to-end type safety between the frontend and backend.
- **Interfaces/Types**: Define clear interfaces or types for component props and data models.

## 🧪 Testing Policy

Testing is essential for maintaining a stable application.

### Playwright E2E Tests

- **New Features**: Every new feature **must** be accompanied by Playwright E2E tests.
- **Changed Features**: Update or adopt existing E2E tests if your changes affect existing functionality.
- **Location**: Store E2E tests in `apps/web/tests/`.
- **Naming**: Use the `.spec.ts` suffix (e.g., `my-feature.spec.ts`).
- **Running Tests**:
  ```bash
  pnpm --filter web test:e2e
  ```

### Unit & Integration Tests

- While E2E tests are our primary focus for user journeys, unit tests for complex logic are highly encouraged.
- Location: Co-locate test files with their source files (e.g., `Component.test.tsx` next to `Component.tsx`).

## 🔢 Versioning Policy

Athena follows [Semantic Versioning 2.0.0](https://semver.org/). Version numbers are structured as `MAJOR.MINOR.PATCH`:

- **MAJOR**: Incompatible API changes or breaking features.
- **MINOR**: Adding functionality in a backwards-compatible manner (e.g., new features).
- **PATCH**: Backwards-compatible bug fixes.

We use our commit messages to help determine version increments during the release process.

## 📜 Git Commit Guidelines

We follow the **Conventional Commits** specification. Your commit messages should be structured as follows:

`<type>[optional scope]: <description>`

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Formatting, missing semi-colons, etc.
- `refactor`: Refactoring production code
- `test`: Adding or refactoring tests
- `chore`: Maintenance tasks

**Example:**
`feat(web): add support for markdown in index cards`

## 📬 Pull Request Process

1.  **Branching**: Always develop on a feature branch.
2.  **Squash and Merge**: We typically squash and merge PRs to keep the main branch history clean.
3.  **Review**: At least one maintainer should review and approve your PR before merging.
4.  **CI**: Ensure all CI checks (linting, building, tests) pass before requesting a review.

---

Thank you for contributing to make Athena better! 🦉
