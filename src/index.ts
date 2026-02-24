#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GitLabClient, GitLabConfig } from "./gitlab-client.js";

function createServer(instanceId?: string): Server {
  const serverName = instanceId
    ? `gitlab-mcp-server-${instanceId}`
    : "gitlab-mcp-server";

  return new Server(
    {
      name: serverName,
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );
}

interface ServerConfig {
  gitlab: GitLabConfig;
  instanceId?: string;
}

function getServerConfig(): ServerConfig {
  const host = process.env.GITLAB_HOST;
  const token = process.env.GITLAB_API_TOKEN;
  const instanceId = process.env.MCP_INSTANCE_ID || "";

  if (!host || !token) {
    throw new Error(
      "GITLAB_HOST and GITLAB_API_TOKEN environment variables are required",
    );
  }

  return {
    gitlab: { host, token },
    instanceId,
  };
}

let gitlabClient: GitLabClient;
let serverConfig: ServerConfig;
let server: Server;

try {
  serverConfig = getServerConfig();
  gitlabClient = new GitLabClient(serverConfig.gitlab);
  server = createServer(serverConfig.instanceId);
} catch (error) {
  console.error("Failed to initialize server:", error);
  process.exit(1);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_merge_request",
        description:
          "Get merge request details including title, description, and optionally the diff/changes",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description:
                'GitLab project ID or path (e.g., "group/project" or "123")',
            },
            mergeRequestIid: {
              type: "number",
              description: "Merge request internal ID (IID)",
            },
            includeDiff: {
              type: "boolean",
              description:
                "Whether to include the diff/changes in the response (default: false)",
            },
          },
          required: ["projectId", "mergeRequestIid"],
        },
      },
      {
        name: "list_merge_requests",
        description: "List merge requests for a project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description:
                'GitLab project ID or path (e.g., "group/project" or "123")',
            },
            state: {
              type: "string",
              enum: ["opened", "closed", "merged", "all"],
              description: "Filter merge requests by state (default: opened)",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "get_commit_diff",
        description: "Get commit details and diff from a GitLab commit URL",
        inputSchema: {
          type: "object",
          properties: {
            commitUrl: {
              type: "string",
              description:
                'Full GitLab commit URL (e.g., "https://gitlab.com/group/project/-/commit/abc123...")',
            },
          },
          required: ["commitUrl"],
        },
      },
      {
        name: "get_merge_request_pipelines",
        description: "Get pipelines for a merge request",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description:
                'GitLab project ID or path (e.g., "group/project" or "123")',
            },
            mergeRequestIid: {
              type: "number",
              description: "Merge request internal ID (IID)",
            },
          },
          required: ["projectId", "mergeRequestIid"],
        },
      },
      {
        name: "get_pipeline_jobs",
        description: "Get jobs for a pipeline",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description:
                'GitLab project ID or path (e.g., "group/project" or "123")',
            },
            pipelineId: {
              type: "number",
              description: "Pipeline ID",
            },
          },
          required: ["projectId", "pipelineId"],
        },
      },
      {
        name: "get_failed_jobs",
        description:
          "Get failed jobs by pipeline ID or by latest merge request pipeline",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description:
                'GitLab project ID or path (e.g., "group/project" or "123")',
            },
            pipelineId: {
              type: "number",
              description: "Pipeline ID",
            },
            mergeRequestIid: {
              type: "number",
              description:
                "Merge request internal ID (IID), uses latest MR pipeline",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "get_job_log",
        description: "Get job log (trace) for a job",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description:
                'GitLab project ID or path (e.g., "group/project" or "123")',
            },
            jobId: {
              type: "number",
              description: "Job ID",
            },
          },
          required: ["projectId", "jobId"],
        },
      },
      {
        name: "get_job_artifacts",
        description: "Get job artifacts metadata and download links",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description:
                'GitLab project ID or path (e.g., "group/project" or "123")',
            },
            jobId: {
              type: "number",
              description: "Job ID",
            },
          },
          required: ["projectId", "jobId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_merge_request": {
        const { projectId, mergeRequestIid, includeDiff } = args as {
          projectId: string;
          mergeRequestIid: number;
          includeDiff?: boolean;
        };

        const mergeRequest = await gitlabClient.getMergeRequest(
          projectId,
          mergeRequestIid,
        );

        let result: any = mergeRequest;

        if (includeDiff) {
          const diff = await gitlabClient.getMergeRequestDiff(
            projectId,
            mergeRequestIid,
          );
          result = {
            ...mergeRequest,
            diff: diff,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_merge_requests": {
        const { projectId, state } = args as {
          projectId: string;
          state?: "opened" | "closed" | "merged" | "all";
        };

        const mergeRequests = await gitlabClient.listMergeRequests(projectId, {
          state,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(mergeRequests, null, 2),
            },
          ],
        };
      }

      case "get_commit_diff": {
        const { commitUrl } = args as {
          commitUrl: string;
        };

        const commitDiff = await gitlabClient.getCommitDiff(commitUrl);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(commitDiff, null, 2),
            },
          ],
        };
      }

      case "get_merge_request_pipelines": {
        const { projectId, mergeRequestIid } = args as {
          projectId: string;
          mergeRequestIid: number;
        };

        const pipelines = await gitlabClient.getMergeRequestPipelines(
          projectId,
          mergeRequestIid,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pipelines, null, 2),
            },
          ],
        };
      }

      case "get_pipeline_jobs": {
        const { projectId, pipelineId } = args as {
          projectId: string;
          pipelineId: number;
        };

        const jobs = await gitlabClient.getPipelineJobs(projectId, pipelineId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobs, null, 2),
            },
          ],
        };
      }

      case "get_failed_jobs": {
        const { projectId, pipelineId, mergeRequestIid } = args as {
          projectId: string;
          pipelineId?: number;
          mergeRequestIid?: number;
        };

        if (!pipelineId && !mergeRequestIid) {
          throw new Error(
            "Either pipelineId or mergeRequestIid must be provided",
          );
        }

        const failedJobs = await gitlabClient.getFailedJobs(projectId, {
          pipelineId,
          mergeRequestIid,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(failedJobs, null, 2),
            },
          ],
        };
      }

      case "get_job_log": {
        const { projectId, jobId } = args as {
          projectId: string;
          jobId: number;
        };

        const jobLog = await gitlabClient.getJobLog(projectId, jobId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobLog, null, 2),
            },
          ],
        };
      }

      case "get_job_artifacts": {
        const { projectId, jobId } = args as {
          projectId: string;
          jobId: number;
        };

        const jobArtifacts = await gitlabClient.getJobArtifacts(projectId, jobId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobArtifacts, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  console.error(
    `GitLab MCP server running on stdio${serverConfig.instanceId ? ` (instance: ${serverConfig.instanceId})` : ""}`,
  );
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
