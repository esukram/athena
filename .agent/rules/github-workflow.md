---
trigger: manual
---

# GitHub Workflow

This workflow defines the process for working on GitHub issues within this repository.

## Steps

1.  **Fetch GitHub Issue Data**
    - Identify the issue number to work on.
    - Use the GitHub CLI (`gh issue view <number>`) to understand the requirements and context.

2.  **Create New Git Branch**
    - Create a descriptive branch name based on the issue (e.g., `feat/issue-number-description` or `fix/issue-number-description`).
    - Command: `git checkout -b <branch-name>`

3.  **Publish Branch & Create PR**
    - Push the empty branch to the remote repository.
    - Create a Draft Pull Request immediately to link it to the issue and announce work.
    - Use `gh pr create --draft --title "<type>: <description>" --body "Closes #<issue-number>"`
    - Ensure the title follows [Conventional Commits](git-commit-instructions.md).

4.  **Implementation**
    - Implement the feature or fix according to the issue instructions.
    - Follow [React Best Practices](react-best-practices.md) and [Design Aesthetics](../../CONTRIBUTING.md).

5.  **Regular Commits**
    - Make regular, small, and logical commits.
    - Always follow the [Conventional Commits](git-commit-instructions.md) specification.
    - Focus only on staged changes.

6.  **Quality Assurance**
    - Before pushing, ensure all checks pass:
      - **Linting**: Run `pnpm lint` (or equivalent) to ensure code style consistency.
      - **Formatting**: Run `pnpm format` (or equivalent) to fix any formatting issues.
      - **Testing**: Run all units tests and E2E tests using `pnpm test:e2e`.

7.  **Push & Finalize PR**
    - Push the final changes: `git push`
    - Once all quality checks pass and implementation is complete, mark the PR as "Ready for Review".
    - Use `gh pr ready`.
