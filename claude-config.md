# Configuring Claude to Use GitLab MCP Server

## Prerequisites

1. Set up your environment variables:
   ```bash
   export GITLAB_HOST=https://your-gitlab-instance.com
   export GITLAB_TOKEN=your_gitlab_access_token
   ```

2. Build the MCP server:
   ```bash
   npm install
   npm run build
   ```

## Configuration Options

### Option 1: Claude Desktop App

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "node",
      "args": ["/Users/ales.drobysh/workspace/gitlab-mcp/dist/index.js"],
      "env": {
        "GITLAB_HOST": "https://your-gitlab-instance.com",
        "GITLAB_TOKEN": "your_gitlab_access_token"
      }
    }
  }
}
```

### Option 2: Claude Code CLI

Create or edit your Claude Code configuration:

**File**: `~/.config/claude/settings.json`

```json
{
  "mcp": {
    "servers": {
      "gitlab": {
        "command": "node",
        "args": ["/Users/ales.drobysh/workspace/gitlab-mcp/dist/index.js"],
        "env": {
          "GITLAB_HOST": "https://your-gitlab-instance.com",
          "GITLAB_TOKEN": "your_gitlab_access_token"
        }
      }
    }
  }
}
```

### Option 3: Using NPM Global Install

If you want to install globally:

```bash
# Make the package installable globally
npm pack
npm install -g gitlab-mcp-server-1.0.0.tgz

# Then use in config:
{
  "mcpServers": {
    "gitlab": {
      "command": "gitlab-mcp-server",
      "env": {
        "GITLAB_HOST": "https://your-gitlab-instance.com",
        "GITLAB_TOKEN": "your_gitlab_access_token"
      }
    }
  }
}
```

## Environment Variables Setup

### Option A: System Environment Variables
```bash
# Add to your ~/.bashrc, ~/.zshrc, or equivalent
export GITLAB_HOST="https://your-gitlab-instance.com"
export GITLAB_TOKEN="your_gitlab_access_token"
```

### Option B: .env File (Development)
Create `.env` in the project root:
```bash
GITLAB_HOST=https://your-gitlab-instance.com
GITLAB_TOKEN=your_gitlab_access_token
```

Then modify your config to load from .env:
```json
{
  "mcpServers": {
    "gitlab": {
      "command": "node",
      "args": ["-r", "dotenv/config", "/Users/ales.drobysh/workspace/gitlab-mcp/dist/index.js"]
    }
  }
}
```

## Getting Your GitLab Token

1. Go to your GitLab instance
2. Navigate to **User Settings** → **Access Tokens**
3. Create a new token with these scopes:
   - `api` (for full API access)
   - `read_repository` (minimum for MR diffs)
4. Copy the token and use it as `GITLAB_TOKEN`

## Testing the Configuration

After configuring, restart Claude and test with:

```
Can you list the open merge requests for project "mygroup/myproject"?
```

Or:

```
Get me the details of merge request 42 in project 123
```

## Troubleshooting

1. **Server not starting**: Check that Node.js path is correct and environment variables are set
2. **Authentication errors**: Verify your GitLab token has proper permissions
3. **Connection issues**: Ensure GITLAB_HOST is accessible and correct

## Security Notes

- Keep your GitLab token secure and never commit it to version control
- Use environment variables or secure configuration management
- Rotate tokens periodically
- Use minimal required permissions for the token