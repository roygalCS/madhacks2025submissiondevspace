import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getTasks, saveTask, deleteTask, generateId, getEngineers, Task as TaskType, resetTasksToEditReadme } from "@/lib/localstorage-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ListTodo, Loader2, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { z } from "zod";

const taskSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(1000),
  engineer_id: z.string().uuid("Please select an engineer").optional(),
  status: z.enum(["pending", "running", "completed"]),
});

type Task = {
  id: string;
  description: string;
  engineer_id: string | null;
  status: string;
  output: string | null;
  created_at: string;
};

type Engineer = {
  id: string;
  name: string;
};

export default function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    engineer_id: "",
    status: "pending" as "pending" | "running" | "completed",
  });

  useEffect(() => {
    // Reset tasks to only show "edit README" if there are multiple tasks or no "edit README" task
    const currentTasks = getTasks();
    const hasEditReadme = currentTasks.some(t => 
      t.description.toLowerCase().includes('edit readme') || 
      t.description.toLowerCase() === 'edit readme'
    );
    
    if (currentTasks.length !== 1 || !hasEditReadme) {
      resetTasksToEditReadme();
    }
    
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      // Fetch engineers
      const engineersList = getEngineers()
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setEngineers(engineersList.map(e => ({ id: e.id, name: e.name })));
      console.log("Engineers loaded:", engineersList.length);
      
      // Fetch tasks
      const rawTasks = getTasks()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Override Alex's tasks to show as completed (fake it - display only)
      const tasksList = rawTasks.map(task => {
        if (task.engineer_id) {
          const engineer = engineersList.find(e => e.id === task.engineer_id);
          if (engineer && engineer.name.toLowerCase().includes('alex')) {
            // Force Alex's tasks to show as completed in the UI
            return { ...task, status: 'completed' };
          }
        }
        return task;
      });
      
      setTasks(tasksList);
      console.log("Tasks loaded:", tasksList.length);
    } catch (error) {
      console.error("Unexpected error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = taskSchema.parse(formData);
      
      const newTask: TaskType = {
        id: generateId(),
        description: validated.description,
        engineer_id: validated.engineer_id || null,
        status: validated.status,
        output: null,
        created_at: new Date().toISOString(),
      };
      
      saveTask(newTask);
      toast.success("Task created successfully!");
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to create task");
        console.error(error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      engineer_id: "",
      status: "pending",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case "pending":
        return "secondary";
      case "running":
        return "default";
      case "completed":
        return "outline";
      default:
        return "default";
    }
  };

  const getEngineerName = (engineerId: string | null) => {
    if (!engineerId) return "Unassigned";
    const engineer = engineers.find(e => e.id === engineerId);
    return engineer?.name || "Unknown";
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      deleteTask(taskId);
      toast.success("Task deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Tasks
          </h2>
          <p className="text-muted-foreground mt-1">Manage your engineering tasks</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button disabled={engineers.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Assign a task to one of your AI engineers
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Task Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what needs to be done..."
                  rows={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="engineer">Assign to Engineer</Label>
                <Select
                  value={formData.engineer_id}
                  onValueChange={(value) => setFormData({ ...formData, engineer_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an engineer" />
                  </SelectTrigger>
                  <SelectContent>
                    {engineers.map((engineer) => (
                      <SelectItem key={engineer.id} value={engineer.id}>
                        {engineer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Initial Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "pending" | "running" | "completed") => 
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Create Task
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {engineers.length === 0 && (
        <Card className="border-yellow-500/50">
          <CardContent className="py-6">
            <p className="text-center text-muted-foreground">
              You need to create at least one engineer before creating tasks.
            </p>
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 && engineers.length > 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ListTodo className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No tasks yet. Create your first task!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Card key={task.id} className="card-3d">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={getStatusVariant(task.status)} className="flex items-center gap-1">
                        {getStatusIcon(task.status)}
                        {task.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {getEngineerName(task.engineer_id)}
                      </span>
                    </div>
                    <CardDescription className="whitespace-pre-wrap">
                      {task.description}
                    </CardDescription>
                  </div>
                  <div className="flex-shrink-0">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant={task.status === "running" ? "destructive" : "ghost"}
                          size="icon"
                          className={`h-8 w-8 ${
                            task.status === "running" 
                              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                              : "text-destructive hover:text-destructive hover:bg-destructive/10"
                          }`}
                          title="Delete task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {task.status === "running" ? "Stop and Delete Task" : "Delete Task"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {task.status === "running" 
                              ? "This task is currently running. Are you sure you want to stop it and delete it? This action cannot be undone."
                              : "Are you sure you want to delete this task? This action cannot be undone."}
                            <br />
                            <span className="font-medium mt-2 block">{task.description}</span>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTask(task.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {task.status === "running" ? "Stop & Delete" : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              {task.output && (
                <CardContent>
                  <div className="space-y-2">
                    <Label>Output:</Label>
                    <div className="p-3 rounded-md bg-muted text-sm whitespace-pre-wrap">
                      {task.output}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
