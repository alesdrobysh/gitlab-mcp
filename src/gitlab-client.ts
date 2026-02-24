import { Gitlab } from '@gitbeaker/rest';

export interface GitLabConfig {
  host: string;
  token: string;
}

interface GitLabPipeline {
  id: number;
  iid?: number;
  project_id?: number;
  sha?: string;
  ref?: string;
  status?: string;
  source?: string;
  web_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface GitLabJob {
  id: number;
  status?: string;
  stage?: string;
  name?: string;
  ref?: string;
  tag?: boolean;
  coverage?: number | null;
  allow_failure?: boolean;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  duration?: number | null;
  queued_duration?: number | null;
  web_url?: string;
  artifacts_file?: {
    filename?: string;
    size?: number;
  };
  artifacts?: Array<{
    file_type?: string;
    size?: number;
    filename?: string;
    file_format?: string;
  }>;
  runner?: {
    id?: number;
    description?: string;
  };
  pipeline?: {
    id?: number;
    project_id?: number;
    status?: string;
    ref?: string;
    sha?: string;
  };
}

interface ParsedCommitUrl {
  projectId: string;
  commitSha: string;
}

function parseGitLabCommitUrl(url: string): ParsedCommitUrl {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    
    // Expected format: /group/project/-/commit/sha
    // or /group/subgroup/project/-/commit/sha
    const commitIndex = pathParts.indexOf('commit');
    if (commitIndex === -1 || commitIndex === pathParts.length - 1) {
      throw new Error('Invalid commit URL format');
    }
    
    const commitSha = pathParts[commitIndex + 1];
    
    // Extract project path (everything before /-/commit)
    const dashIndex = pathParts.indexOf('-');
    if (dashIndex === -1 || dashIndex === 0) {
      throw new Error('Invalid GitLab URL format');
    }
    
    const projectPath = pathParts.slice(0, dashIndex).join('/');
    
    return {
      projectId: projectPath,
      commitSha: commitSha,
    };
  } catch (error) {
    throw new Error(`Failed to parse GitLab commit URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export class GitLabClient {
  private api: InstanceType<typeof Gitlab>;
  private host: string;
  private token: string;

  constructor(config: GitLabConfig) {
    this.host = config.host.replace(/\/$/, '');
    this.token = config.token;
    this.api = new Gitlab({
      host: config.host,
      token: config.token,
    });
  }

  private async requestGitLab<T>(path: string): Promise<T> {
    const response = await fetch(`${this.host}/api/v4${path}`, {
      headers: {
        'PRIVATE-TOKEN': this.token,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API request failed (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  private async requestGitLabText(path: string): Promise<string> {
    const response = await fetch(`${this.host}/api/v4${path}`, {
      headers: {
        'PRIVATE-TOKEN': this.token,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitLab API request failed (${response.status}): ${errorBody}`);
    }

    return response.text();
  }

  async getMergeRequest(projectId: string | number, mergeRequestIid: number) {
    try {
      const mr = await this.api.MergeRequests.show(projectId, mergeRequestIid);
      return {
        title: mr.title,
        description: mr.description,
        state: mr.state,
        source_branch: mr.source_branch,
        target_branch: mr.target_branch,
        author: mr.author,
        created_at: mr.created_at,
        updated_at: mr.updated_at,
        web_url: mr.web_url,
      };
    } catch (error) {
      throw new Error(`Failed to fetch merge request: ${error}`);
    }
  }

  async getMergeRequestDiff(projectId: string | number, mergeRequestIid: number) {
    try {
      const mr = await this.api.MergeRequests.show(projectId, mergeRequestIid, { includeRebaseInProgress: false });
      
      const mrChanges = await this.api.MergeRequests.show(projectId, mergeRequestIid);
      
      // Try to get changes from the merge request
      if ('changes' in mrChanges && Array.isArray(mrChanges.changes)) {
        return mrChanges.changes.map((change: any) => ({
          old_path: change.old_path,
          new_path: change.new_path,
          diff: change.diff,
          new_file: change.new_file,
          renamed_file: change.renamed_file,
          deleted_file: change.deleted_file,
        }));
      }
      
      // Fallback: get comparison between source and target branches
      try {
        const comparison = await this.api.Repositories.compare(
          projectId, 
          String(mr.target_branch), 
          String(mr.source_branch)
        );
        
        const diffs = Array.isArray(comparison.diffs) ? comparison.diffs : [];
        return diffs.map((change: any) => ({
          old_path: change.old_path,
          new_path: change.new_path,
          diff: change.diff,
          new_file: change.new_file,
          renamed_file: change.renamed_file,
          deleted_file: change.deleted_file,
        }));
      } catch (comparisonError) {
        console.warn('Could not get branch comparison:', comparisonError);
        return [];
      }
    } catch (error) {
      throw new Error(`Failed to fetch merge request diff: ${error}`);
    }
  }

  async listMergeRequests(projectId: string | number, options: { state?: 'opened' | 'closed' | 'merged' | 'all' } = {}) {
    try {
      const requestOptions: any = { projectId };
      if (options.state && options.state !== 'all') {
        requestOptions.state = options.state;
      }
      
      const mrs = await this.api.MergeRequests.all(requestOptions);
      return mrs.map(mr => ({
        iid: mr.iid,
        title: mr.title,
        state: mr.state,
        source_branch: mr.source_branch,
        target_branch: mr.target_branch,
        author: mr.author?.name,
        created_at: mr.created_at,
        web_url: mr.web_url,
      }));
    } catch (error) {
      throw new Error(`Failed to list merge requests: ${error}`);
    }
  }

  async getCommitDiff(commitUrl: string) {
    try {
      const { projectId, commitSha } = parseGitLabCommitUrl(commitUrl);
      
      const commit = await this.api.Commits.show(projectId, commitSha);
      const commitDiff = await this.api.Commits.showDiff(projectId, commitSha);
      
      return {
        commit: {
          id: commit.id,
          short_id: commit.short_id,
          title: commit.title,
          message: commit.message,
          author_name: commit.author_name,
          author_email: commit.author_email,
          authored_date: commit.authored_date,
          committer_name: commit.committer_name,
          committer_email: commit.committer_email,
          committed_date: commit.committed_date,
          web_url: commit.web_url,
        },
        diff: Array.isArray(commitDiff) ? commitDiff.map((change: any) => ({
          old_path: change.old_path,
          new_path: change.new_path,
          diff: change.diff,
          new_file: change.new_file,
          renamed_file: change.renamed_file,
          deleted_file: change.deleted_file,
        })) : [],
      };
    } catch (error) {
      throw new Error(`Failed to fetch commit diff: ${error}`);
    }
  }

  async getMergeRequestPipelines(projectId: string | number, mergeRequestIid: number) {
    try {
      const encodedProjectId = encodeURIComponent(String(projectId));
      const pipelines = await this.requestGitLab<GitLabPipeline[]>(
        `/projects/${encodedProjectId}/merge_requests/${mergeRequestIid}/pipelines`,
      );

      return (Array.isArray(pipelines) ? pipelines : []).map((pipeline) => ({
        id: pipeline.id,
        iid: pipeline.iid,
        project_id: pipeline.project_id,
        sha: pipeline.sha,
        ref: pipeline.ref,
        status: pipeline.status,
        source: pipeline.source,
        web_url: pipeline.web_url,
        created_at: pipeline.created_at,
        updated_at: pipeline.updated_at,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch merge request pipelines: ${error}`);
    }
  }

  async getPipelineJobs(projectId: string | number, pipelineId: number) {
    try {
      const encodedProjectId = encodeURIComponent(String(projectId));
      const jobs = await this.requestGitLab<GitLabJob[]>(
        `/projects/${encodedProjectId}/pipelines/${pipelineId}/jobs`,
      );

      return (Array.isArray(jobs) ? jobs : []).map((job) => ({
        id: job.id,
        status: job.status,
        stage: job.stage,
        name: job.name,
        ref: job.ref,
        tag: job.tag,
        allow_failure: job.allow_failure,
        created_at: job.created_at,
        started_at: job.started_at,
        finished_at: job.finished_at,
        duration: job.duration,
        queued_duration: job.queued_duration,
        web_url: job.web_url,
        pipeline: job.pipeline,
        runner: job.runner,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch pipeline jobs: ${error}`);
    }
  }

  async getFailedJobs(
    projectId: string | number,
    options: { pipelineId?: number; mergeRequestIid?: number },
  ) {
    try {
      if (options.pipelineId) {
        const jobs = await this.getPipelineJobs(projectId, options.pipelineId);
        return jobs.filter((job) => job.status === 'failed');
      }

      if (options.mergeRequestIid) {
        const pipelines = await this.getMergeRequestPipelines(projectId, options.mergeRequestIid);
        if (pipelines.length === 0) {
          return {
            pipeline: null,
            failed_jobs: [],
          };
        }

        const latestPipeline = [...pipelines].sort((a, b) => b.id - a.id)[0];
        const jobs = await this.getPipelineJobs(projectId, latestPipeline.id);

        return {
          pipeline: latestPipeline,
          failed_jobs: jobs.filter((job) => job.status === 'failed'),
        };
      }

      throw new Error('Either pipelineId or mergeRequestIid must be provided');
    } catch (error) {
      throw new Error(`Failed to fetch failed jobs: ${error}`);
    }
  }

  async getJobLog(projectId: string | number, jobId: number) {
    try {
      const encodedProjectId = encodeURIComponent(String(projectId));
      const trace = await this.requestGitLabText(
        `/projects/${encodedProjectId}/jobs/${jobId}/trace`,
      );

      return {
        job_id: jobId,
        trace,
      };
    } catch (error) {
      throw new Error(`Failed to fetch job log: ${error}`);
    }
  }

  async getJobArtifacts(projectId: string | number, jobId: number) {
    try {
      const encodedProjectId = encodeURIComponent(String(projectId));
      const job = await this.requestGitLab<GitLabJob>(
        `/projects/${encodedProjectId}/jobs/${jobId}`,
      );

      return {
        job_id: job.id,
        job_name: job.name,
        status: job.status,
        artifacts_file: job.artifacts_file ?? null,
        artifacts: Array.isArray(job.artifacts)
          ? job.artifacts.map((artifact) => ({
              file_type: artifact.file_type,
              file_format: artifact.file_format,
              filename: artifact.filename,
              size: artifact.size,
            }))
          : [],
        download_url: `${this.host}/api/v4/projects/${encodedProjectId}/jobs/${jobId}/artifacts`,
        browse_url: `${this.host}/api/v4/projects/${encodedProjectId}/jobs/${jobId}/artifacts/*artifact_path`,
      };
    } catch (error) {
      throw new Error(`Failed to fetch job artifacts: ${error}`);
    }
  }
}
