import { Gitlab } from '@gitbeaker/rest';

export interface GitLabConfig {
  host: string;
  token: string;
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
}