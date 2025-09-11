import { Gitlab } from '@gitbeaker/rest';

export interface GitLabConfig {
  host: string;
  token: string;
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

  constructor(config: GitLabConfig) {
    this.api = new Gitlab({
      host: config.host,
      token: config.token,
    });
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
}