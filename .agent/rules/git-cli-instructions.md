---
trigger: manual
---

# **GitHub CLI Interaction**

## **Description**

This skill enables the agent to interact with GitHub repositories, issues, pull requests, and workflows using the official GitHub CLI (gh). It provides a structured way to automate common developer workflows directly through terminal commands.

## **Prerequisites**

- **GitHub CLI Installed**: gh must be available in the environment.
- **Authentication**: The agent or environment must be authenticated via gh auth login or by providing a GITHUB_TOKEN environment variable with appropriate scopes (repo, workflow, gist, etc.).

## **Core Capabilities**

### **1\. Repository Management**

Commands for cloning, creating, and viewing repository information.

| Action              | Command                                     |
| :------------------ | :------------------------------------------ |
| **Clone**           | gh repo clone \<owner\>/\<repo\>            |
| **Create**          | gh repo create \<name\> \--public/--private |
| **View README**     | gh repo view \<owner\>/\<repo\>             |
| **List User Repos** | gh repo list \<owner\>                      |

### **2\. Issue Tracking**

Efficiently manage tasks and bugs.

- **List Issues**: gh issue list \--label "bug" \--assignee "@me"
- **Create Issue**: gh issue create \--title "Title" \--body "Description" \--label "task"
- **View Issue**: gh issue view \<number\>
- **Close Issue**: gh issue close \<number\>

### **3\. Pull Request (PR) Workflow**

The heart of collaborative development.

- **Create PR**: gh pr create \--title "Feature: X" \--body "Details" \--base main
- **List PRs**: gh pr list \--state open
- **Checkout PR**: gh pr checkout \<number\>
- **Merge PR**: gh pr merge \<number\> \--merge \--auto (or \--squash)
- **Review PR**: gh pr review \<number\> \--approve \--body "LGTM\!"

### **4\. GitHub Actions (Workflows)**

Monitor and trigger automation.

- **List Runs**: gh run list \--workflow \<filename\>
- **View Log**: gh run view \<run-id\> \--log
- **Trigger Workflow**: gh workflow run \<workflow-id-or-name\>

### **5. Workflow **

When working on a feature, always create a new branch and a new pull request. Ensure to have meaningful branch names and pull request titles. Create commits with meaningful commit messages and reasonable changes per commit.

## **Advanced Scripting Patterns**

### **JSON Output & Filtering**

The GitHub CLI supports \--json flags, which are essential for agents to parse data programmatically using jq.

**Example: Get the IDs of all open PRs by a specific user**

gh pr list \--json number,author \--jq '.\[\] | select(.author.login \== "octocat") | .number'

### **Environment Variables**

For non-interactive environments (CI/CD or headless agents):

- GITHUB_TOKEN: Used for API authentication.
- GH_REPO: Sets the default repository for commands if not inside a git folder.

## **Best Practices for Agents**

1. **Always use \--json**: When the agent needs to "read" state, use JSON output to avoid parsing brittle text tables.
2. **Idempotency**: Check if a PR or Issue already exists before creating a new one to avoid duplicates.
3. **Limit Scope**: Only request the permissions necessary for the specific task (e.g., don't ask for admin if you only need repo access).
4. **Error Handling**: Capture stderr. If gh returns a non-zero exit code, parse the error message to explain to the user why the action failed (e.g., "Branch already exists").

## **Example Agent Prompt**

"Use the GitHub CLI to list the last 5 closed issues in the current repository that have the 'documentation' label, then summarize their resolutions."
