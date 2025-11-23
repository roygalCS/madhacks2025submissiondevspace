import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Zap } from "lucide-react";
import EngineersTab from "@/components/dashboard/EngineersTab";
import TasksTab from "@/components/dashboard/TasksTab";
import ConnectionsTab from "@/components/dashboard/ConnectionsTab";
import ChatTab from "@/components/dashboard/ChatTab";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { isGitHubAuthenticated, getGitHubUserFromStorage, logoutGitHub } from "@/lib/github-auth";
import { ThreeJSBackground } from "@/components/ThreeJSBackground";

export default function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    if (!isGitHubAuthenticated()) {
      navigate("/auth");
      return;
    }

    const user = getGitHubUserFromStorage();
    if (user) {
      setUserName(user.login);
    }
    setLoading(false);
  }, [navigate]);

  const handleLogout = () => {
    logoutGitHub();
    toast.success("Signed out successfully");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <Zap className="h-12 w-12 mx-auto text-cyan-400 mb-4 animate-bounce" />
            <p className="text-lg font-medium text-muted-foreground">Loading DevSpace...</p>
            <p className="text-sm text-muted-foreground">Setting up your AI engineering team</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Three.js Background */}
      <ThreeJSBackground />
      
      {/* Top Navigation */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-20" />
        <div className="relative z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-cyan-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              DevSpace
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus />
            <span className="text-sm text-muted-foreground">{userName || 'GitHub User'}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="engineers" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl mb-8 card-3d bg-card/50 backdrop-blur-sm">
            <TabsTrigger value="engineers">Engineers</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="engineers">
            <EngineersTab />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksTab />
          </TabsContent>

          <TabsContent value="connections">
            <ConnectionsTab />
          </TabsContent>

          <TabsContent value="chat">
            <ChatTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
