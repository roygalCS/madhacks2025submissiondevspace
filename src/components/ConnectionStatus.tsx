import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { isGitHubAuthenticated } from '@/lib/github-auth';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const [apiStatus, setApiStatus] = useState<{
    fishaudio: 'ready' | 'missing';
    supabase: 'ready' | 'missing';
    github: 'ready' | 'missing';
  }>({
    fishaudio: 'missing',
    supabase: 'missing',
    github: 'missing',
  });

  useEffect(() => {
    // Check API keys (only in browser)
    if (typeof window === 'undefined') return;
    
    const fishAudioKey = import.meta.env.VITE_FISHAUDIO_API_KEY;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    
    try {
      const githubAuthenticated = isGitHubAuthenticated();
      setApiStatus({
        fishaudio: fishAudioKey ? 'ready' : 'missing',
        supabase: (supabaseUrl && supabaseKey) ? 'ready' : 'missing',
        github: githubClientId ? (githubAuthenticated ? 'ready' : 'missing') : 'missing',
      });
    } catch (error) {
      console.error('Error checking connections:', error);
      setApiStatus({
        fishaudio: fishAudioKey ? 'ready' : 'missing',
        supabase: (supabaseUrl && supabaseKey) ? 'ready' : 'missing',
        github: 'missing',
      });
    }
  }, []);

  const allReady = 
    apiStatus.fishaudio === 'ready' && 
    apiStatus.supabase === 'ready' &&
    apiStatus.github === 'ready';

  if (allReady) {
    return null; // Don't show if everything is ready
  }

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      {apiStatus.fishaudio === 'missing' && (
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-yellow-500" />
          FishAudio Key Missing
        </Badge>
      )}

      {apiStatus.supabase === 'missing' && (
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-yellow-500" />
          Supabase Not Configured
        </Badge>
      )}

      {apiStatus.github === 'missing' && (
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-yellow-500" />
          GitHub {!import.meta.env.VITE_GITHUB_CLIENT_ID ? 'Not Configured' : 'Not Authenticated'}
        </Badge>
      )}
    </div>
  );
}

