import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Github, Loader2 } from "lucide-react";
import { 
  initiateGitHubLogin, 
  handleGitHubCallback, 
  getGitHubUser, 
  storeGitHubAuth, 
  isGitHubAuthenticated 
} from "@/lib/github-auth";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    if (isGitHubAuthenticated()) {
      navigate("/dashboard");
      return;
    }

    // Handle OAuth callback
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      toast.error(`GitHub OAuth error: ${error}`);
      return;
    }

    if (code && state) {
      processCallback(code, state);
    }
  }, [navigate, searchParams]);

  const processCallback = async (code: string, state: string) => {
    setProcessing(true);
    try {
      // Exchange code for token
      const token = await handleGitHubCallback(code, state);
      
      // Get user info
      const user = await getGitHubUser(token);
      
      // Store auth
      storeGitHubAuth(token, user);
      
      toast.success(`Welcome, ${user.login}!`);
      navigate("/dashboard");
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to authenticate with GitHub');
    } finally {
      setProcessing(false);
    }
  };

  const handleGitHubLogin = () => {
    setLoading(true);
    try {
      initiateGitHubLogin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to initiate GitHub login');
      setLoading(false);
    }
  };

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-cyan-400" />
              <p className="text-lg font-medium">Completing GitHub authentication...</p>
              <p className="text-sm text-muted-foreground">Please wait</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            DevSpace
          </CardTitle>
          <CardDescription>
            Sign in with GitHub to get started with your AI engineering team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleGitHubLogin} 
            className="w-full" 
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Redirecting to GitHub...
              </>
            ) : (
              <>
                <Github className="h-4 w-4 mr-2" />
                Sign in with GitHub
              </>
            )}
          </Button>
          
          <div className="text-xs text-center text-muted-foreground space-y-2 pt-4 border-t">
            <p>By signing in, you'll be able to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Connect your GitHub repositories</li>
              <li>Work with AI engineers on your codebase</li>
              <li>Manage tasks and track progress</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
