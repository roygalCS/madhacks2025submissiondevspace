/**
 * GitHub OAuth Authentication
 * Handles GitHub OAuth flow and token management
 */

export interface GitHubUser {
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  id: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
}

/**
 * Initiate GitHub OAuth login
 */
export function initiateGitHubLogin(): void {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error('GitHub Client ID is not configured. Please set VITE_GITHUB_CLIENT_ID in your .env file');
  }

  const redirectUri = `${window.location.origin}/auth/github/callback`;
  const scope = 'read:user repo';
  const state = Math.random().toString(36).substring(7); // Random state for security
  
  // Store state in localStorage to verify callback
  localStorage.setItem('github_oauth_state', state);
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  
  window.location.href = githubAuthUrl;
}

/**
 * Handle GitHub OAuth callback
 * Exchange code for access token
 */
export async function handleGitHubCallback(code: string, state: string): Promise<string> {
  // Verify state
  const storedState = localStorage.getItem('github_oauth_state');
  if (!storedState || storedState !== state) {
    throw new Error('Invalid OAuth state. Please try logging in again.');
  }
  localStorage.removeItem('github_oauth_state');

  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GITHUB_CLIENT_SECRET;
  
  if (!clientId) {
    throw new Error('GitHub Client ID is not configured');
  }

  // Exchange code for token
  // Use Vite proxy to avoid CORS issues (browsers can't directly call GitHub's token endpoint)
  const redirectUri = `${window.location.origin}/auth/github/callback`;
  
  if (!clientSecret) {
    throw new Error('GitHub Client Secret is required. Please set VITE_GITHUB_CLIENT_SECRET in your .env file.');
  }

  try {
    // Use proxy endpoint to avoid CORS
    const response = await fetch('/api/github/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub OAuth token exchange failed:', errorText);
      throw new Error(`Failed to exchange code for token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    if (!data.access_token) {
      throw new Error('No access token received from GitHub');
    }

    return data.access_token;
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    throw error;
  }
}

/**
 * Get current GitHub user info
 */
export async function getGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub user info');
  }

  return response.json();
}

/**
 * Get user's repositories
 */
export async function getGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(`https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch GitHub repositories');
    }

    const pageRepos: GitHubRepo[] = await response.json();
    
    if (pageRepos.length === 0) {
      break;
    }

    repos.push(...pageRepos);
    
    // If we got fewer than perPage, we're done
    if (pageRepos.length < perPage) {
      break;
    }
    
    page++;
  }

  return repos;
}

/**
 * Store GitHub auth in localStorage
 */
export function storeGitHubAuth(token: string, user: GitHubUser): void {
  localStorage.setItem('github_token', token);
  localStorage.setItem('github_user', JSON.stringify(user));
  localStorage.setItem('github_authenticated', 'true');
}

/**
 * Get stored GitHub token
 */
export function getGitHubToken(): string | null {
  return localStorage.getItem('github_token');
}

/**
 * Get stored GitHub user
 */
export function getGitHubUserFromStorage(): GitHubUser | null {
  const userStr = localStorage.getItem('github_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isGitHubAuthenticated(): boolean {
  return localStorage.getItem('github_authenticated') === 'true' && !!getGitHubToken();
}

/**
 * Logout (clear GitHub auth)
 */
export function logoutGitHub(): void {
  localStorage.removeItem('github_token');
  localStorage.removeItem('github_user');
  localStorage.removeItem('github_authenticated');
  localStorage.removeItem('github_oauth_state');
}

