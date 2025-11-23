import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Github, CheckCircle2, XCircle, Loader2, ExternalLink, GitBranch, AlertCircle } from "lucide-react";
import { getEngineerBranches } from "@/lib/github-operations";
import { getGitHubToken, getGitHubUserFromStorage, getGitHubRepos, GitHubRepo } from "@/lib/github-auth";

type ConnectionStatus = {
  status: 'checking' | 'connected' | 'error' | 'not_configured';
  message: string;
  branches?: number;
};

type Connection = {
  github_username: string;
  github_repo_name: string;
  base_branch: string;
};

export default function ConnectionsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'not_configured',
    message: 'Not configured',
  });
  const [formData, setFormData] = useState({
    selected_repo: "",
    base_branch: "main",
  });

  useEffect(() => {
    fetchConnection();
    loadRepos();
  }, []);

  const loadRepos = async () => {
    const token = getGitHubToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoadingRepos(true);
    try {
      const userRepos = await getGitHubRepos(token);
      setRepos(userRepos);
      
      // If we have a saved connection, try to match it
      const saved = getSavedConnection();
      if (saved && userRepos.length > 0) {
        const matchedRepo = userRepos.find(r => r.full_name === `${saved.github_username}/${saved.github_repo_name}`);
        if (matchedRepo) {
          setFormData({
            selected_repo: matchedRepo.full_name,
            base_branch: saved.base_branch || matchedRepo.default_branch || 'main',
          });
        }
      }
    } catch (error) {
      console.error('Error loading repos:', error);
      toast.error('Failed to load repositories');
    } finally {
      setLoadingRepos(false);
      setLoading(false);
    }
  };

  const getSavedConnection = (): Connection | null => {
    try {
      const saved = localStorage.getItem('github_connection');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  const saveConnection = (conn: Connection) => {
    localStorage.setItem('github_connection', JSON.stringify(conn));
  };

  const fetchConnection = () => {
    const saved = getSavedConnection();
    if (saved) {
      setConnection(saved);
      setFormData({
        selected_repo: `${saved.github_username}/${saved.github_repo_name}`,
        base_branch: saved.base_branch || 'main',
      });
      // Auto-test connection
      setTimeout(() => testConnection(), 500);
    }
    setLoading(false);
  };

  const testConnection = async () => {
    const token = getGitHubToken();
    if (!token) {
      toast.error('GitHub token not found. Please log in again.');
      return;
    }

    if (!formData.selected_repo) {
      setConnectionStatus({
        status: 'not_configured',
        message: 'Select a repository to test connection',
      });
      return;
    }

    const [username, repoName] = formData.selected_repo.split('/');
    if (!username || !repoName) {
      setConnectionStatus({
        status: 'error',
        message: 'Invalid repository format',
      });
      return;
    }

    setTesting(true);
    setConnectionStatus({
      status: 'checking',
      message: 'Testing connection...',
    });

    try {
      // Test 1: Verify repository exists and is accessible
      const repoResponse = await fetch(
        `https://api.github.com/repos/${username}/${repoName}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!repoResponse.ok) {
        if (repoResponse.status === 404) {
          throw new Error(`Repository not found: ${username}/${repoName}`);
        }
        if (repoResponse.status === 403) {
          throw new Error('Access denied. Token may not have repository access.');
        }
        throw new Error(`Repository error: ${repoResponse.statusText}`);
      }

      const repoData = await repoResponse.json();

      // Test 2: Check if base branch exists
      const branchName = formData.base_branch || repoData.default_branch || 'main';
      const branchResponse = await fetch(
        `https://api.github.com/repos/${username}/${repoName}/branches/${branchName}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!branchResponse.ok && branchResponse.status !== 404) {
        throw new Error(`Branch check failed: ${branchResponse.statusText}`);
      }

      // Test 3: Get engineer branches count
      let branchesCount = 0;
      try {
        const branches = await getEngineerBranches(
          username,
          repoName,
          token
        );
        branchesCount = branches.length;
      } catch (error) {
        // Ignore branch fetch errors - not critical
        console.warn('Could not fetch engineer branches:', error);
      }

      setConnectionStatus({
        status: 'connected',
        message: `Connected to ${username}/${repoName}`,
        branches: branchesCount,
      });

      toast.success('GitHub connection successful!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectionStatus({
        status: 'error',
        message: errorMessage,
      });
      console.error('Connection test failed:', error);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!formData.selected_repo) {
        toast.error("Please select a repository");
        return;
      }

      const [username, repoName] = formData.selected_repo.split('/');
      if (!username || !repoName) {
        toast.error("Invalid repository format");
        return;
      }

      // Test connection before saving
      if (connectionStatus.status !== 'connected') {
        toast.error("Please test and verify connection before saving");
        return;
      }

      const token = getGitHubToken();
      if (!token) {
        toast.error("GitHub token not found. Please log in again.");
        return;
      }

      const newConnection: Connection = {
        github_username: username,
        github_repo_name: repoName,
        base_branch: formData.base_branch || 'main',
      };

      saveConnection(newConnection);
      setConnection(newConnection);

      toast.success("GitHub connection saved successfully!");
    } catch (error) {
      toast.error("Failed to save connection");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const selectedRepo = repos.find(r => r.full_name === formData.selected_repo);
  const repoUrl = selectedRepo ? selectedRepo.html_url : null;

  if (loading || loadingRepos) {
    return <div className="text-center py-8 text-muted-foreground">Loading repositories...</div>;
  }

  const token = getGitHubToken();
  if (!token) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            GitHub Repository
          </h2>
          <p className="text-muted-foreground mt-1">
            Please sign in with GitHub to connect your repositories
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500" />
              <p className="text-lg font-medium">Not Authenticated</p>
              <p className="text-sm text-muted-foreground">
                You need to sign in with GitHub to connect repositories
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          GitHub Repository
        </h2>
        <p className="text-muted-foreground mt-1">
          Select a repository for your AI engineers to work on
        </p>
      </div>

      {/* Connection Status Card */}
      {connectionStatus.status !== 'not_configured' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {connectionStatus.status === 'checking' && (
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                )}
                {connectionStatus.status === 'connected' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {connectionStatus.status === 'error' && (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium">
                    {connectionStatus.status === 'connected' ? 'Connected' : 
                     connectionStatus.status === 'error' ? 'Connection Failed' : 
                     'Testing...'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {connectionStatus.message}
                  </p>
                </div>
              </div>
              {connectionStatus.status === 'connected' && connectionStatus.branches !== undefined && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {connectionStatus.branches} engineer branch{connectionStatus.branches !== 1 ? 'es' : ''}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="card-3d">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5 text-cyan-400" />
            Repository Selection
          </CardTitle>
          <CardDescription>
            Choose which repository your AI engineers will work on. Each engineer gets their own branch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Repository Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="selected_repo">
                Select Repository
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Select
                value={formData.selected_repo}
                onValueChange={(value) => {
                  setFormData({ ...formData, selected_repo: value });
                  const repo = repos.find(r => r.full_name === value);
                  if (repo) {
                    setFormData(prev => ({
                      ...prev,
                      selected_repo: value,
                      base_branch: repo.default_branch || 'main',
                    }));
                  }
                  // Reset connection status when repo changes
                  setConnectionStatus({
                    status: 'not_configured',
                    message: 'Select a repository',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a repository..." />
                </SelectTrigger>
                <SelectContent>
                  {repos.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No repositories found</div>
                  ) : (
                    repos.map((repo) => (
                      <SelectItem key={repo.id} value={repo.full_name}>
                        <div className="flex items-center justify-between w-full">
                          <span>{repo.full_name}</span>
                          {repo.private && (
                            <Badge variant="outline" className="ml-2 text-xs">Private</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {repos.length} repository{repos.length !== 1 ? 'ies' : ''} found
              </p>
            </div>

            {/* Base Branch */}
            <div className="space-y-2">
              <Label htmlFor="base_branch">Base Branch</Label>
              <input
                id="base_branch"
                type="text"
                value={formData.base_branch}
                onChange={(e) => setFormData({ ...formData, base_branch: e.target.value })}
                placeholder="main"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Branch engineers will create their branches from (default: main)
              </p>
            </div>

            {repoUrl && (
              <div className="p-3 bg-cyan-400/10 border border-cyan-400/20 rounded-lg">
                <p className="text-sm font-medium mb-1 text-cyan-400">Selected Repository:</p>
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                >
                  {repoUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-cyan-400/10 border border-cyan-400/20 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-cyan-400">How It Works</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Each AI engineer gets their own branch: <code className="bg-muted px-1 rounded">ai-engineer-{`{id}`}-{`{name}`}</code></li>
                    <li>Engineers can read files, commit changes, and push to their branches</li>
                    <li>You can review changes on GitHub and merge when ready</li>
                    <li>Engineers automatically pull latest changes from {formData.base_branch || 'main'} before working</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={testing || !formData.selected_repo}
                className="flex-1"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={saving || connectionStatus.status !== 'connected'}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Connection"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
