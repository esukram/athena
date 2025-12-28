---
trigger: always_on
---
# Git Commit Message Conventions

You must follow the Conventional Commits specification for all generated commit messages. 

### 1. Message Structure
The message must be structured as follows:
<type>[optional scope]: <description>

[body]

[optional footer(s)]

### 2. Commit Types
- **feat**: A new feature for the user, not a new feature for builds.
- **fix**: A bug fix for the user, not a fix to a build script.
- **docs**: Changes to the documentation.
- **style**: Formatting, missing semi-colons, etc; no production code change.
- **refactor**: Refactoring production code, e.g. renaming a variable.
- **test**: Adding missing tests, refactoring tests; no production code change.
- **chore**: Updating grunt tasks etc; no production code change.
- **perf**: Code change that improves performance.
- **ci**: Changes to CI configuration files and scripts.
- **build**: Changes that affect the build system or external dependencies.
- **agent**: Changes to the agent or vibe-coding definitions.

### 3. Rules for the Description
- Use the imperative, present tense: "change" not "changed" or "changes".
- Do not capitalize the first letter.
- No dot (.) at the end.

### 4. Guidelines for the Body
- Use the body to explain the "what" and "why" of a change, not the "how".
- Separate the subject from the body with a blank line.

### 5. Rules for the Footer
- Place at the end of the message, separated by a blank line.
- For breaking changes, start with "BREAKING CHANGE: " in all caps.
- Use "Fixes: #123" or "Closes: #123" to reference issues.
- Use "Co-authored-by: Name <email>" for multi-author credits.
