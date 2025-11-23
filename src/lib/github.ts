/**
 * GitHub API utility functions for fetching repository file contents
 */

export interface GitHubFile {
  path: string;
  content: string;
  size: number;
}

/**
 * Fetches file contents from a GitHub repository
 * @param username GitHub username
 * @param repoName Repository name
 * @param path File path in the repository
 * @param token Optional GitHub token for authentication (increases rate limits)
 * @returns Decoded file content as string
 */
export async function fetchGitHubFile(
  username: string,
  repoName: string,
  path: string,
  token?: string | null
): Promise<string> {
  const url = `https://api.github.com/repos/${username}/${repoName}/contents/${path}`;
  
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        // Don't log 404 errors - missing files are expected and handled gracefully
        throw new Error(`File not found: ${path}`);
      }
      if (response.status === 403) {
        console.error('GitHub API rate limit exceeded. Consider adding a GitHub token.');
        throw new Error('GitHub API rate limit exceeded. Consider adding a GitHub token.');
      }
      console.error(`GitHub API error for ${path}: ${response.status} ${response.statusText}`);
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // GitHub API returns base64 encoded content for files
    if (data.encoding === 'base64' && data.content) {
      // Remove newlines from base64 content
      const base64Content = data.content.replace(/\n/g, '');
      // Decode base64 to string
      const decoded = atob(base64Content);
      return decoded;
    }
    
    // If it's not base64, return as is (shouldn't happen for files)
    return data.content || '';
  } catch (error) {
    // Only log non-404 errors (404s are expected and handled silently)
    if (error instanceof Error && !error.message.includes('not found')) {
    console.error(`Error fetching GitHub file ${path}:`, error);
    }
    throw error;
  }
}

/**
 * Fetches multiple relevant files from a GitHub repository based on common patterns
 * @param username GitHub username
 * @param repoName Repository name
 * @param token Optional GitHub token
 * @returns Array of file contents
 */
export async function fetchRelevantGitHubFiles(
  username: string,
  repoName: string,
  token?: string | null
): Promise<GitHubFile[]> {
  // Common files that provide good context about a codebase
  const commonFiles = [
    'README.md',
    'package.json',
    'package-lock.json',
    'requirements.txt',
    'Pipfile',
    'go.mod',
    'Cargo.toml',
    'pom.xml',
    'build.gradle',
    'tsconfig.json',
    'vite.config.ts',
    'next.config.js',
    'docker-compose.yml',
    'Dockerfile',
    '.env.example',
  ];

  const files: GitHubFile[] = [];
  const errors: string[] = [];

  // Try to fetch common files (don't fail if some don't exist)
  for (const filePath of commonFiles) {
    try {
      const content = await fetchGitHubFile(username, repoName, filePath, token);
      files.push({
        path: filePath,
        content,
        size: content.length,
      });
    } catch (error) {
      // Silently skip files that don't exist
      if (error instanceof Error && error.message.includes('not found')) {
        continue;
      }
      errors.push(`${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (errors.length > 0) {
    console.warn('Some files could not be fetched:', errors);
  }

  return files;
}

/**
 * Formats GitHub file contents for inclusion in LLM context
 * @param files Array of GitHub files
 * @returns Formatted string for LLM context
 */
export function formatFilesForContext(files: GitHubFile[]): string {
  if (files.length === 0) {
    return '';
  }

  let context = '\n\n## Repository Context\n\n';
  context += 'The following files from the connected GitHub repository provide context:\n\n';

  for (const file of files) {
    // Limit file size to prevent token overflow (keep first 2000 chars)
    const content = file.content.length > 2000 
      ? file.content.substring(0, 2000) + '\n... (truncated)'
      : file.content;
    
    context += `### ${file.path}\n\`\`\`\n${content}\n\`\`\`\n\n`;
  }

  return context;
}

/**
 * Fetches directory contents from a GitHub repository
 * @param username GitHub username
 * @param repoName Repository name
 * @param path Directory path (default: root)
 * @param token Optional GitHub token
 * @returns Array of file/directory entries
 */
export async function fetchGitHubDirectory(
  username: string,
  repoName: string,
  path: string = '',
  token?: string | null
): Promise<Array<{ name: string; path: string; type: 'file' | 'dir'; size: number }>> {
  const url = `https://api.github.com/repos/${username}/${repoName}/contents/${path}`;
  
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Directory not found: ${path}`);
      }
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Consider adding a GitHub token.');
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // GitHub API returns array for directories
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? 'dir' : 'file',
        size: item.size || 0,
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching GitHub directory ${path}:`, error);
    throw error;
  }
}

/**
 * Fetches latest commits from a GitHub repository
 * @param username GitHub username
 * @param repoName Repository name
 * @param token Optional GitHub token
 * @param limit Number of commits to fetch (default: 5)
 * @returns Array of commit information
 */
export async function fetchGitHubCommits(
  username: string,
  repoName: string,
  token?: string | null,
  limit: number = 5
): Promise<Array<{ sha: string; message: string; author: string; date: string; url: string }>> {
  const url = `https://api.github.com/repos/${username}/${repoName}/commits?per_page=${limit}`;
  
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository not found: ${username}/${repoName}`);
      }
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Consider adding a GitHub token.');
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.map((commit: any) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split('\n')[0], // First line only
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url,
    }));
  } catch (error) {
    console.error(`Error fetching GitHub commits:`, error);
    throw error;
  }
}

/**
 * Extracts file paths mentioned in text (e.g., "review src/App.tsx")
 * @param text User input text
 * @returns Array of potential file paths
 */
export function extractFilePaths(text: string): string[] {
  const patterns = [
    /(?:review|analyze|check|look at|examine|read)\s+([^\s]+\.(ts|tsx|js|jsx|py|java|go|rs|rb|php|css|html|json|md|yml|yaml))/gi,
    /(?:file|filepath|path):\s*([^\s]+)/gi,
    /([a-zA-Z0-9_\-./]+\.(ts|tsx|js|jsx|py|java|go|rs|rb|php|css|html|json|md|yml|yaml))/gi,
  ];

  const paths = new Set<string>();

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const path = match[1] || match[0];
      if (path && !path.startsWith('http')) {
        paths.add(path.trim());
      }
    }
  }

  return Array.from(paths);
}

/**
 * Formats a single file for code review context
 * @param filePath File path
 * @param content File content
 * @returns Formatted string for LLM
 */
export function formatFileForReview(filePath: string, content: string): string {
  const lines = content.split('\n');
  const lineCount = lines.length;
  
  let formatted = `\n\n## File: ${filePath} (${lineCount} lines)\n\n`;
  formatted += '```\n';
  
  // Add line numbers
  lines.forEach((line, index) => {
    formatted += `${(index + 1).toString().padStart(4, ' ')} | ${line}\n`;
  });
  
  formatted += '```\n';
  formatted += '\nPlease analyze this code for:\n';
  formatted += '- Bugs and potential errors\n';
  formatted += '- Security vulnerabilities\n';
  formatted += '- Performance issues\n';
  formatted += '- Code quality and best practices\n';
  formatted += '- Suggest specific improvements with line numbers\n';
  
  return formatted;
}

