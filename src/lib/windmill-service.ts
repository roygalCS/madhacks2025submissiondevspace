/**
 * Windmill API Service
 * Handles workflow automation and task execution
 */

export interface WindmillWorkflowOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface WindmillRunOptions {
  workflowId?: string;
  workflowPath?: string;
  input?: Record<string, any>;
}

export class WindmillService {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: WindmillWorkflowOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://app.windmill.dev/api';
  }

  /**
   * Run a Windmill workflow
   */
  async runWorkflow(options: WindmillRunOptions): Promise<any> {
    const { workflowId, workflowPath, input = {} } = options;

    if (!workflowId && !workflowPath) {
      throw new Error('Either workflowId or workflowPath must be provided');
    }

    const endpoint = workflowId 
      ? `${this.baseUrl}/w/${workflowId}/run`
      : `${this.baseUrl}/w/${workflowPath}/run`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Windmill workflow error: ${error.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error running Windmill workflow:', error);
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(runId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get workflow status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting workflow status:', error);
      throw error;
    }
  }

  /**
   * List available workflows
   */
  async listWorkflows(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/workspaces/list`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list workflows: ${response.statusText}`);
      }

      const data = await response.json();
      return data.workspaces || [];
    } catch (error) {
      console.error('Error listing workflows:', error);
      throw error;
    }
  }
}

