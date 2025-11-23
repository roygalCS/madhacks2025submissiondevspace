import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getEngineers, saveEngineer, deleteEngineer, generateId, Engineer as EngineerType } from "@/lib/localstorage-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Bot, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { getMVPAvatars, forceResetMVPVoices } from "@/lib/mvp-avatars";

// FishAudio Voice IDs
// Get voice IDs from: https://fish.audio/docs
// Example: 802e3bc2b27e49c2995d23ef70e6ac89 (Energetic Male)

const engineerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  personality: z.string().trim().max(500).optional(),
  avatar_url: z.string().trim().url("Must be a valid URL").optional().or(z.literal("")),
  fish_voice_id: z.string().trim().max(100).optional(),
  specialty: z.enum(["backend", "frontend", "fullstack", "security", "devops", "mobile", "ai/ml", "general"]).optional(),
});

type Engineer = {
  id: string;
  name: string;
  personality: string | null;
  avatar_url: string | null;
  fish_voice_id: string | null;
  gemini_voice: string | null;
  specialty: string | null;
  created_at: string;
};

export default function EngineersTab() {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEngineer, setEditingEngineer] = useState<Engineer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    personality: "",
    avatar_url: "",
    fish_voice_id: import.meta.env.VITE_FISHAUDIO_DEFAULT_VOICE_ID || "",
    specialty: "general" as "backend" | "frontend" | "fullstack" | "security" | "devops" | "mobile" | "ai/ml" | "general",
  });

  useEffect(() => {
    fetchEngineers();
  }, []);

  const fetchEngineers = async () => {
    setLoading(true);
    try {
      const engineersList = getEngineers()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setEngineers(engineersList);
      console.log("Engineers loaded from localStorage:", engineersList.length);
    } catch (error) {
      console.error("Error loading engineers:", error);
      toast.error("Failed to load engineers");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // MVP: Limit to 4 engineers
    if (!editingEngineer && engineers.length >= 4) {
      toast.error("MVP: Maximum of 4 engineers allowed");
      return;
    }

    try {
      const validated = engineerSchema.parse(formData);

      if (editingEngineer) {
        // Update existing engineer
        const updated: EngineerType = {
          ...editingEngineer,
          name: validated.name,
          personality: validated.personality || null,
          avatar_url: validated.avatar_url || null,
          fish_voice_id: validated.fish_voice_id || null,
          gemini_voice: null, // Deprecated - kept for backward compatibility
          specialty: validated.specialty || null,
        };
        saveEngineer(updated);
        toast.success("Engineer updated successfully!");
      } else {
        // Create new engineer
        const newEngineer: EngineerType = {
          id: generateId(),
          name: validated.name,
          personality: validated.personality || null,
          avatar_url: validated.avatar_url || null,
          fish_voice_id: validated.fish_voice_id || null,
          gemini_voice: null, // Deprecated - kept for backward compatibility
          specialty: validated.specialty || null,
          created_at: new Date().toISOString(),
        };
        saveEngineer(newEngineer);
        toast.success("Engineer created successfully!");
      }

      fetchEngineers();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to save engineer");
        console.error(error);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this engineer?")) return;

    try {
      // First, check if engineer has any tasks assigned
      const { getTasks, saveTask } = await import('@/lib/localstorage-data');
      const tasks = getTasks().filter(t => t.engineer_id === id);

      if (tasks.length > 0) {
        const taskCount = tasks.length;
        if (!confirm(
          `This engineer has ${taskCount} task(s) assigned. ` +
          `Tasks will be unassigned (engineer_id set to null). Continue?`
        )) {
          return;
        }

        // Unassign tasks
        tasks.forEach(task => {
          saveTask({ ...task, engineer_id: null });
        });
      }

      // Delete the engineer
      deleteEngineer(id);
      toast.success("Engineer deleted successfully!");
      fetchEngineers();
    } catch (error) {
      console.error("Unexpected error deleting engineer:", error);
      toast.error("An unexpected error occurred while deleting the engineer");
    }
  };

  const openEditDialog = (engineer: Engineer) => {
    setEditingEngineer(engineer);
    setFormData({
      name: engineer.name,
      personality: engineer.personality || "",
      avatar_url: engineer.avatar_url || "",
      fish_voice_id: engineer.fish_voice_id || "",
      specialty: (engineer.specialty as any) || "general",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingEngineer(null);
    setFormData({
      name: "",
      personality: "",
      avatar_url: "",
      fish_voice_id: import.meta.env.VITE_FISHAUDIO_DEFAULT_VOICE_ID || "",
      specialty: "general",
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading engineers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            AI Engineers
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage your AI engineering team (MVP: Limited to 4 avatars)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              forceResetMVPVoices();
              fetchEngineers();
              toast.success("MVP voices reset to correct assignments");
            }}
            title="Reset MVP avatar voices to correct assignments (Alex=Puck, Sam=Kore, Jordan=Charon, Casey=Aoede)"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset Voices
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button disabled={engineers.length >= 4}>
                <Plus className="h-4 w-4 mr-2" />
                Add Engineer {engineers.length >= 4 && '(MVP: Max 4)'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEngineer ? "Edit Engineer" : "Add New Engineer"}</DialogTitle>
                <DialogDescription>
                  {editingEngineer ? "Update your AI engineer's details" : "Choose a preset or create a custom engineer"}
                </DialogDescription>
              </DialogHeader>

              {!editingEngineer && (
                <div className="space-y-3 mb-4">
                  <Label className="text-sm font-semibold">Quick Add Presets</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {getMVPAvatars().map((preset) => {
                      const isAlreadyAdded = engineers.some(e => e.name === preset.name);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setFormData({
                              name: preset.name,
                              personality: preset.personality || "",
                              avatar_url: preset.avatar_url,
                              fish_voice_id: preset.fish_voice_id || "",
                              specialty: preset.specialty as any,
                            });
                          }}
                          disabled={isAlreadyAdded}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${isAlreadyAdded
                            ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                            : "border-border hover:border-cyan-400 hover:bg-cyan-400/10 cursor-pointer"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-cyan-400" />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm">{preset.name}</div>
                              <div className="text-xs text-muted-foreground capitalize">{preset.specialty}</div>
                            </div>
                            {isAlreadyAdded && (
                              <Badge variant="secondary" className="text-xs">Added</Badge>
                            )}
                          </div>
                          {preset.personality && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{preset.personality}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click a preset to fill the form, or fill it manually below
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Engineer Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Alex Frontend Pro"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personality">Personality Description</Label>
                  <Textarea
                    id="personality"
                    value={formData.personality}
                    onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                    placeholder="Describe the engineer's personality and approach..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatar_url">Ready Player Me Avatar URL</Label>
                  <Input
                    id="avatar_url"
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    placeholder="https://models.readyplayer.me/YOUR_AVATAR_ID.glb"
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your avatar from{" "}
                    <a href="https://readyplayer.me" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                      readyplayer.me
                    </a>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fish_voice_id">FishAudio Voice ID</Label>
                  <Input
                    id="fish_voice_id"
                    value={formData.fish_voice_id}
                    onChange={(e) => setFormData({ ...formData, fish_voice_id: e.target.value })}
                    placeholder="e.g., 802e3bc2b27e49c2995d23ef70e6ac89"
                  />
                  <p className="text-xs text-muted-foreground">
                    Get voice IDs from{" "}
                    <a href="https://fish.audio/docs" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                      fish.audio/docs
                    </a>
                    . Leave empty to use default voice.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Specialty</Label>
                  <Select
                    value={formData.specialty}
                    onValueChange={(value: any) => setFormData({ ...formData, specialty: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="backend">Backend</SelectItem>
                      <SelectItem value="frontend">Frontend</SelectItem>
                      <SelectItem value="fullstack">Full Stack</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="devops">DevOps</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                      <SelectItem value="ai/ml">AI/ML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  {editingEngineer ? "Update Engineer" : "Create Engineer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {engineers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No engineers yet. Create your first AI engineer!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {engineers.map((engineer) => (
            <Card key={engineer.id} className="card-3d hover:border-cyan-400/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-cyan-400" />
                    <CardTitle className="text-lg">{engineer.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(engineer)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(engineer.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {engineer.personality && (
                  <CardDescription className="line-clamp-2">
                    {engineer.personality}
                  </CardDescription>
                )}
                {engineer.specialty && (
                  <Badge variant="outline" className="mt-2">
                    {engineer.specialty}
                  </Badge>
                )}
              </CardHeader>
              {(engineer.avatar_url || engineer.fish_voice_id) && (
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  {engineer.avatar_url && (
                    <div className="truncate">Avatar: {engineer.avatar_url}</div>
                  )}
                  {engineer.fish_voice_id && (
                    <div>Voice: {engineer.fish_voice_id}</div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
