# GitLab MCP Server

A Model Context Protocol (MCP) server for GitLab integration, written in TypeScript. This server allows you to interact with GitLab merge requests through MCP tools.

## Features

- 🔍 Get merge request details (title, description, metadata)
- 📄 Retrieve merge request diffs
- 📋 List merge requests for a project
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
- `GITLAB_TOKEN`: Your GitLab access token

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
4. Copy the token and set it as `GITLAB_TOKEN`

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
GITLAB_HOST=https://gitlab.example.com GITLAB_TOKEN=token1 MCP_INSTANCE_ID=instance1 npm start

# Instance 2 (in terminal 2)  
GITLAB_HOST=https://gitlab.com GITLAB_TOKEN=token2 MCP_INSTANCE_ID=instance2 npm start

# Instance 3 (in terminal 3)
GITLAB_HOST=https://gitlab.internal.com GITLAB_TOKEN=token3 MCP_INSTANCE_ID=instance3 npm start
```

Each instance can connect to different GitLab hosts with different tokens, allowing multiple tools to work with different GitLab environments simultaneously.

### Available Tools

#### `get_merge_request`
Get detailed information about a specific merge request, optionally including the diff/changes.

**Parameters:**
- `projectId` (string): GitLab project ID or path (e.g., "group/project" or "123")
- `mergeRequestIid` (number): Merge request internal ID (IID)
- `includeDiff` (optional boolean): Whether to include the diff/changes in the response (default: false)

#### `list_merge_requests`
List merge requests for a project.

**Parameters:**
- `projectId` (string): GitLab project ID or path
- `state` (optional string): Filter by state ("opened", "closed", "merged", "all"). Default: "opened"

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

// List open merge requests
await callTool("list_merge_requests", {
  projectId: "mygroup/myproject",
  state: "opened"
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
        "GITLAB_TOKEN": "company_token",
        "MCP_INSTANCE_ID": "company"
      }
    },
    "gitlab-personal": {
      "command": "node", 
      "args": ["path/to/gitlab-mcp/dist/index.js"],
      "env": {
        "GITLAB_HOST": "https://gitlab.com",
        "GITLAB_TOKEN": "personal_token",
        "MCP_INSTANCE_ID": "personal"
      }
    },
    "gitlab-internal": {
      "command": "node",
      "args": ["path/to/gitlab-mcp/dist/index.js"], 
      "env": {
        "GITLAB_HOST": "https://gitlab.internal.company.com",
        "GITLAB_TOKEN": "internal_token",
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