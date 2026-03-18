# GitLab MCP Server

A Model Context Protocol (MCP) server for GitLab integration, written in TypeScript. This server allows you to interact with GitLab merge requests, commits, pipelines, and jobs through MCP tools.

## Features

- 🔍 Get merge request details (title, description, metadata)
- 📝 Create merge requests in GitLab projects
- 📄 Retrieve merge request diffs
- 📋 List merge requests for a project
- 🔀 Get pipelines for a merge request
- 🧰 Get jobs for a pipeline
- 🚨 Get failed jobs by pipeline or merge request
- 📜 Retrieve job logs (trace)
- 📦 Retrieve job artifacts metadata and download links
- 🔐 Supports self-hosted GitLab instances
- 🔑 Token-based authentication via environment variables

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Set the following environment variables:

### Required
- `GITLAB_HOST`: Your GitLab instance URL (e.g., `https://gitlab.example.com` or `https://gitlab.com`)
- `GITLAB_API_TOKEN`: Your GitLab access token

### Optional (for multiple instances)
- `MCP_INSTANCE_ID`: Unique identifier for the server instance (useful for logging and identification)

You can copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# Edit .env with your GitLab configuration
```

### Getting a GitLab Access Token

1. Go to your GitLab instance
2. Navigate to User Settings → Access Tokens
3. Create a new token with `api` scope
4. Copy the token and set it as `GITLAB_API_TOKEN`

## Usage

### Running the Server

#### Single Instance
```bash
# Development mode
npm run dev

# Production mode
npm run build && npm start
```

#### Multiple Instances
Each instance runs as a separate process with its own configuration:

```bash
# Build first
npm run build

# Instance 1 (in terminal 1)
GITLAB_HOST=https://gitlab.example.com GITLAB_API_TOKEN=token1 MCP_INSTANCE_ID=instance1 npm start

# Instance 2 (in terminal 2)
GITLAB_HOST=https://gitlab.com GITLAB_API_TOKEN=token2 MCP_INSTANCE_ID=instance2 npm start

# Instance 3 (in terminal 3)
GITLAB_HOST=https://gitlab.internal.com GITLAB_API_TOKEN=token3 MCP_INSTANCE_ID=instance3 npm start
```

Each instance can connect to different GitLab hosts with different tokens, allowing multiple tools to work with different GitLab environments simultaneously.

### Available Tools

#### `get_merge_request`
Get detailed information about a specific merge request, optionally including the diff/changes.

**Parameters:**
- `projectId` (string): GitLab project ID or path (e.g., "group/project" or "123")
- `mergeRequestIid` (number): Merge request internal ID (IID)
- `includeDiff` (optional boolean): Whether to include the diff/changes in the response (default: false)

The response includes automation-friendly metadata such as `id`, `iid`, `draft`, `source_project_id`, `target_project_id`, `labels`, `assignees`, `reviewers`, `diff_refs`, and `sha`. When `includeDiff` is enabled, the response also includes `diff_overflow`.

#### `create_merge_request`
Create a merge request in a GitLab project.

**Parameters:**
- `projectId` (string): GitLab project ID or path
- `sourceBranch` (string): Source branch name
- `targetBranch` (string): Target branch name
- `title` (string): Merge request title
- `description` (optional string): Merge request description
- `labels` (optional string[]): Labels to apply
- `assigneeId` / `assigneeIds` (optional number / number[]): Assignee user IDs
- `reviewerId` / `reviewerIds` (optional number / number[]): Reviewer user IDs
- `removeSourceBranch` (optional boolean): Remove the source branch on merge
- `allowCollaboration` (optional boolean): Allow upstream members to push
- `allowMaintainerToPush` (optional boolean): Allow maintainers to push
- `squash` (optional boolean): Suggest squashing commits on merge
- `targetProjectId` (optional number): Target project ID for cross-project MRs
- `draft` (optional boolean): Prefix the title with `Draft:`

#### `list_merge_requests`
List merge requests for a project.

**Parameters:**
- `projectId` (string): GitLab project ID or path
- `state` (optional string): Filter by state ("opened", "closed", "merged", "all"). Default: "opened"

#### `get_commit_diff`
Get commit details and diff using a full GitLab commit URL.

**Parameters:**
- `commitUrl` (string): Full GitLab commit URL

#### `get_merge_request_pipelines`
Get pipelines for a merge request.

**Parameters:**
- `projectId` (string): GitLab project ID or path
- `mergeRequestIid` (number): Merge request internal ID (IID)

#### `get_pipeline_jobs`
Get jobs for a pipeline.

**Parameters:**
- `projectId` (string): GitLab project ID or path
- `pipelineId` (number): Pipeline ID

#### `get_failed_jobs`
Get failed jobs either directly by pipeline ID or from the latest pipeline of a merge request.

**Parameters:**
- `projectId` (string): GitLab project ID or path
- `pipelineId` (optional number): Pipeline ID
- `mergeRequestIid` (optional number): Merge request internal ID (IID)

Provide either `pipelineId` or `mergeRequestIid`.

#### `get_job_log`
Get job log (trace) for a job.

**Parameters:**
- `projectId` (string): GitLab project ID or path
- `jobId` (number): Job ID

#### `get_job_artifacts`
Get job artifacts metadata and download links for a job.

**Parameters:**
- `projectId` (string): GitLab project ID or path
- `jobId` (number): Job ID

## Example Usage with MCP Client

```javascript
// Get merge request details only
await callTool("get_merge_request", {
  projectId: "mygroup/myproject",
  mergeRequestIid: 42
});

// Get merge request details with diff
await callTool("get_merge_request", {
  projectId: "123",
  mergeRequestIid: 42,
  includeDiff: true
});

// Create a merge request
await callTool("create_merge_request", {
  projectId: "mygroup/myproject",
  sourceBranch: "feature/new-e2e-test",
  targetBranch: "main",
  title: "Add login dashboard E2E coverage",
  description: "## Summary\n- add a generated Playwright test\n- validate the scenario locally",
  labels: ["qa", "e2e"],
  removeSourceBranch: true
});

// List open merge requests
await callTool("list_merge_requests", {
  projectId: "mygroup/myproject",
  state: "opened"
});

// List pipelines for an MR
await callTool("get_merge_request_pipelines", {
  projectId: "mygroup/myproject",
  mergeRequestIid: 42
});

// Get jobs from pipeline
await callTool("get_pipeline_jobs", {
  projectId: "mygroup/myproject",
  pipelineId: 123456
});

// Get failed jobs from latest MR pipeline
await callTool("get_failed_jobs", {
  projectId: "mygroup/myproject",
  mergeRequestIid: 42
});

// Get raw CI job log
await callTool("get_job_log", {
  projectId: "mygroup/myproject",
  jobId: 987654
});

// Get artifact metadata and links
await callTool("get_job_artifacts", {
  projectId: "mygroup/myproject",
  jobId: 987654
});
```

## Multiple Instance Setup

When running multiple instances, each tool/client can connect to a different instance:

### MCP Client Configuration Example
```json
{
  "mcpServers": {
    "gitlab-company": {
      "command": "node",
      "args": ["path/to/gitlab-mcp/dist/index.js"],
      "env": {
        "GITLAB_HOST": "https://gitlab.example.com",
        "GITLAB_API_TOKEN": "company_token",
        "MCP_INSTANCE_ID": "company"
      }
    },
    "gitlab-personal": {
      "command": "node",
      "args": ["path/to/gitlab-mcp/dist/index.js"],
      "env": {
        "GITLAB_HOST": "https://gitlab.com",
        "GITLAB_API_TOKEN": "personal_token",
        "MCP_INSTANCE_ID": "personal"
      }
    },
    "gitlab-internal": {
      "command": "node",
      "args": ["path/to/gitlab-mcp/dist/index.js"],
      "env": {
        "GITLAB_HOST": "https://gitlab.internal.company.com",
        "GITLAB_API_TOKEN": "internal_token",
        "MCP_INSTANCE_ID": "internal"
      }
    }
  }
}
```

This allows different tools to connect to different GitLab instances simultaneously, each with their own authentication and configuration.

## Development

The project uses TypeScript and the MCP SDK. Key files:

- `src/index.ts`: Main MCP server implementation
- `src/gitlab-client.ts`: GitLab API client wrapper
- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript configuration

## License

MIT
