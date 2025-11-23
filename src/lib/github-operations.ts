/**
 * GitHub Operations Service
 * Allows AI engineers to work on branches, commit, and push changes
 */

export interface GitHubCommit {
  message: string;
  files: Array<{
    path: string;
    content: string;
    operation: 'create' | 'update' | 'delete';
  }>;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  engineerId: string;
  engineerName: string;
}

/**
 * Get or create a branch for an engineer
 */
export async function getOrCreateEngineerBranch(
  username: string,
  repoName: string,
  engineerId: string,
  engineerName: string,
  token: string,
  baseBranch: string = 'main'
): Promise<string> {
  const branchName = `ai-engineer-${engineerId}-${engineerName.toLowerCase().replace(/\s+/g, '-')}`;
  
  try {
    // Check if branch already exists
    const branchUrl = `https://api.github.com/repos/${username}/${repoName}/git/refs/heads/${branchName}`;
    const branchResponse = await fetch(branchUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (branchResponse.ok) {
      // Branch exists, return it
      console.log(`✅ Branch ${branchName} already exists, using it`);
      return branchName;
    }
    
    // 404 means branch doesn't exist, which is fine - we'll create it
    if (branchResponse.status !== 404) {
      // Some other error occurred
      const error = await branchResponse.json().catch(() => ({}));
      console.warn(`⚠️ Unexpected error checking branch: ${error.message || branchResponse.statusText}`);
    }

    // Branch doesn't exist, create it
    // First, get the SHA of the base branch
    const baseBranchUrl = `https://api.github.com/repos/${username}/${repoName}/git/refs/heads/${baseBranch}`;
    const baseResponse = await fetch(baseBranchUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!baseResponse.ok) {
      throw new Error(`Failed to get base branch ${baseBranch}: ${baseResponse.statusText}`);
    }

    const baseData = await baseResponse.json();
    const baseSha = baseData.object.sha;

    // Create new branch
    const createBranchResponse = await fetch(`https://api.github.com/repos/${username}/${repoName}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    });

    if (!createBranchResponse.ok) {
      const error = await createBranchResponse.json().catch(() => ({}));
      const errorMessage = error.message || createBranchResponse.statusText;
      
      // If branch already exists (422), that's fine - just return the branch name
      if (createBranchResponse.status === 422 && errorMessage.includes('already exists')) {
        console.log(`ℹ️ Branch ${branchName} already exists, using it`);
        return branchName;
      }
      
      throw new Error(`Failed to create branch: ${errorMessage}`);
    }

    return branchName;
  } catch (error) {
    console.error('Error getting/creating engineer branch:', error);
    throw error;
  }
}

/**
 * Get the current SHA of a file in a branch
 */
async function getFileSha(
  username: string,
  repoName: string,
  branch: string,
  path: string,
  token: string
): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${username}/${repoName}/contents/${path}?ref=${branch}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.sha;
    }
    return null; // File doesn't exist
  } catch (error) {
    return null;
  }
}

/**
 * Commit and push changes to a branch
 */
export async function commitAndPush(
  username: string,
  repoName: string,
  branch: string,
  commit: GitHubCommit,
  engineerName: string,
  token: string
): Promise<{ commitSha: string; commitUrl: string }> {
  try {
    // Validate token is provided (required for write operations, even on public repos)
    if (!token || token.trim() === '') {
      throw new Error('GitHub token is required to commit changes. Please add your GitHub Personal Access Token in Connections.');
    }

    // Safety checks - prevent modifying critical files
    const restrictedPaths = [
      '.env',
      '.git',
      'node_modules',
      '.next',
      'dist',
      'build',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
    ];

    const restrictedExtensions = ['.log', '.tmp', '.cache'];

    for (const file of commit.files) {
      // Check restricted paths
      if (restrictedPaths.some(path => file.path.includes(path))) {
        throw new Error(`Cannot modify restricted file: ${file.path}`);
      }

      // Check restricted extensions
      if (restrictedExtensions.some(ext => file.path.endsWith(ext))) {
        throw new Error(`Cannot modify files with extension: ${file.path}`);
      }

      // Warn about root-level critical files but allow (user might want to modify them)
      if (file.path.split('/').length === 1 && 
          ['package.json', 'tsconfig.json', 'vite.config.ts', 'README.md'].includes(file.path)) {
        console.warn(`⚠️ Modifying root-level file ${file.path} - proceed with caution`);
      }
    }

    // Handle deletes separately using Contents API, then create tree for creates/updates
    const baseTreeSha = await getBranchSha(username, repoName, branch, token);
    const tree: any[] = [];
    const deletePromises: Promise<void>[] = [];

    // Process deletes first (using Contents API)
    for (const file of commit.files) {
      if (file.operation === 'delete') {
        const fileSha = await getFileSha(username, repoName, branch, file.path, token);
        if (fileSha) {
          // Delete using Contents API
          const deletePromise = fetch(
            `https://api.github.com/repos/${username}/${repoName}/contents/${encodeURIComponent(file.path)}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `Delete ${file.path}`,
                sha: fileSha,
                branch: branch,
              }),
            }
          ).then(async (response) => {
            if (!response.ok) {
              const error = await response.json().catch(() => ({}));
              throw new Error(`Failed to delete ${file.path}: ${error.message || response.statusText}`);
            }
          });
          deletePromises.push(deletePromise);
        }
      } else {
        // Create or update file - add to tree
        // Use btoa for browser compatibility (instead of Buffer)
        const content = btoa(unescape(encodeURIComponent(file.content)));
        tree.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          content: content,
        });
      }
    }

    // Wait for all deletes to complete
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }

    // If we only had deletes, we need to create a commit with the updated tree
    // If we have creates/updates, create tree and commit
    let treeData: { sha: string };
    
    if (tree.length > 0) {
      // Create tree for creates/updates
      const treeResponse = await fetch(`https://api.github.com/repos/${username}/${repoName}/git/trees`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: tree,
        }),
      });

      if (!treeResponse.ok) {
        const error = await treeResponse.json().catch(() => ({}));
        throw new Error(`Failed to create tree: ${error.message || treeResponse.statusText}`);
      }

      treeData = await treeResponse.json();
    } else {
      // Only deletes - get the updated tree SHA after deletes
      // Wait a moment for GitHub to process the deletes
      await new Promise(resolve => setTimeout(resolve, 500));
      const updatedBranchSha = await getBranchSha(username, repoName, branch, token);
      const commitResponse = await fetch(
        `https://api.github.com/repos/${username}/${repoName}/git/commits/${updatedBranchSha}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      if (!commitResponse.ok) {
        throw new Error('Failed to get updated tree after deletes');
      }
      const commitData = await commitResponse.json();
      treeData = { sha: commitData.tree.sha };
    }

    // Get updated branch SHA (in case deletes changed it)
    const currentBranchSha = await getBranchSha(username, repoName, branch, token);
    
    // Create commit
    const commitResponse = await fetch(`https://api.github.com/repos/${username}/${repoName}/git/commits`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commit.message,
        tree: treeData.sha,
        parents: [currentBranchSha],
        author: {
          name: engineerName,
          email: `${engineerName.toLowerCase().replace(/\s+/g, '-')}@ai-engineer.dev`,
        },
      }),
    });

    if (!commitResponse.ok) {
      const error = await commitResponse.json().catch(() => ({}));
      throw new Error(`Failed to create commit: ${error.message || commitResponse.statusText}`);
    }

    const commitData = await commitResponse.json();

    // Update branch reference
    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${username}/${repoName}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: commitData.sha,
        }),
      }
    );

    if (!updateRefResponse.ok) {
      const error = await updateRefResponse.json().catch(() => ({}));
      throw new Error(`Failed to update branch: ${error.message || updateRefResponse.statusText}`);
    }

    return {
      commitSha: commitData.sha,
      commitUrl: `https://github.com/${username}/${repoName}/commit/${commitData.sha}`,
    };
  } catch (error) {
    console.error('Error committing and pushing:', error);
    throw error;
  }
}

/**
 * Get the SHA of the latest commit on a branch
 */
async function getBranchSha(
  username: string,
  repoName: string,
  branch: string,
  token: string
): Promise<string> {
  const url = `https://api.github.com/repos/${username}/${repoName}/git/refs/heads/${branch}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get branch SHA: ${response.statusText}`);
  }

  const data = await response.json();
  return data.object.sha;
}

/**
 * Pull latest changes from base branch to engineer branch
 */
export async function pullFromBaseBranch(
  username: string,
  repoName: string,
  engineerBranch: string,
  baseBranch: string,
  token: string
): Promise<void> {
  try {
    // Get latest commit from base branch
    const baseSha = await getBranchSha(username, repoName, baseBranch, token);
    const engineerSha = await getBranchSha(username, repoName, engineerBranch, token);

    // Merge base into engineer branch
    const mergeResponse = await fetch(
      `https://api.github.com/repos/${username}/${repoName}/merges`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base: engineerBranch,
          head: baseBranch,
          commit_message: `Merge ${baseBranch} into ${engineerBranch}`,
        }),
      }
    );

    if (!mergeResponse.ok) {
      const error = await mergeResponse.json().catch(() => ({}));
      const errorMessage = error.message || mergeResponse.statusText;
      
      // If already up to date, that's fine
      if (errorMessage.includes('already up to date')) {
        console.log('ℹ️ Branch already up to date with base');
        return;
      }
      
      // If base doesn't exist, that's okay - branch might be new
      if (errorMessage.includes('Base does not exist') || errorMessage.includes('not found')) {
        console.log('ℹ️ Base branch not found, skipping merge (branch may be new)');
        return;
      }
      
      // Log warning but don't throw - allow work to continue
      console.warn(`⚠️ Failed to merge base branch: ${errorMessage} (continuing anyway)`);
      return;
    }
  } catch (error) {
    console.error('Error pulling from base branch:', error);
    throw error;
  }
}

/**
 * Get all engineer branches
 */
export async function getEngineerBranches(
  username: string,
  repoName: string,
  token: string
): Promise<GitHubBranch[]> {
  try {
    const url = `https://api.github.com/repos/${username}/${repoName}/branches`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get branches: ${response.statusText}`);
    }

    const branches = await response.json();
    
    // Filter for AI engineer branches
    return branches
      .filter((b: any) => b.name.startsWith('ai-engineer-'))
      .map((b: any) => {
        const match = b.name.match(/ai-engineer-([^-]+)-(.+)/);
        return {
          name: b.name,
          sha: b.commit.sha,
          engineerId: match ? match[1] : '',
          engineerName: match ? match[2].replace(/-/g, ' ') : '',
        };
      });
  } catch (error) {
    console.error('Error getting engineer branches:', error);
    throw error;
  }
}

/**
 * Create a pull request from engineer branch to base branch
 */
export async function createPullRequest(
  username: string,
  repoName: string,
  engineerBranch: string,
  baseBranch: string,
  title: string,
  body: string,
  engineerName: string,
  token: string
): Promise<{ prNumber: number; prUrl: string }> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${username}/${repoName}/pulls`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
          body: body,
          head: engineerBranch,
          base: baseBranch,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Failed to create PR: ${error.message || response.statusText}`);
    }

    const pr = await response.json();
    return {
      prNumber: pr.number,
      prUrl: pr.html_url,
    };
  } catch (error) {
    console.error('Error creating pull request:', error);
    throw error;
  }
}

