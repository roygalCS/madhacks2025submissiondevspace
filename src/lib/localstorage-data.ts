/**
 * localStorage-based data management
 * Replaces Supabase for engineers, tasks, and connections
 */

export interface Engineer {
  id: string;
  name: string;
  specialty: string | null;
  avatar_url: string | null;
  fish_voice_id: string | null; // Deprecated - kept for backward compatibility
  gemini_voice: string | null; // Deprecated - use fish_voice_id instead
  personality: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  description: string;
  engineer_id: string | null;
  status: string;
  output: string | null;
  created_at: string;
}

const ENGINEERS_KEY = 'devspace_engineers';
const TASKS_KEY = 'devspace_tasks';

/**
 * Get all engineers from localStorage
 */
export function getEngineers(): Engineer[] {
  try {
    const stored = localStorage.getItem(ENGINEERS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Save engineers to localStorage
 */
export function saveEngineers(engineers: Engineer[]): void {
  localStorage.setItem(ENGINEERS_KEY, JSON.stringify(engineers));
}

/**
 * Add or update an engineer
 */
export function saveEngineer(engineer: Engineer): void {
  const engineers = getEngineers();
  const index = engineers.findIndex(e => e.id === engineer.id);
  
  if (index >= 0) {
    engineers[index] = engineer;
  } else {
    engineers.push(engineer);
  }
  
  saveEngineers(engineers);
}

/**
 * Delete an engineer
 */
export function deleteEngineer(engineerId: string): void {
  const engineers = getEngineers();
  const filtered = engineers.filter(e => e.id !== engineerId);
  saveEngineers(filtered);
}

/**
 * Get all tasks from localStorage
 */
export function getTasks(): Task[] {
  try {
    const stored = localStorage.getItem(TASKS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Save tasks to localStorage
 */
export function saveTasks(tasks: Task[]): void {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

/**
 * Add or update a task
 */
export function saveTask(task: Task): void {
  const tasks = getTasks();
  const index = tasks.findIndex(t => t.id === task.id);
  
  if (index >= 0) {
    tasks[index] = task;
  } else {
    tasks.push(task);
  }
  
  saveTasks(tasks);
}

/**
 * Delete a task
 */
export function deleteTask(taskId: string): void {
  const tasks = getTasks();
  const filtered = tasks.filter(t => t.id !== taskId);
  saveTasks(filtered);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Clear all tasks and create a single "edit README" task
 */
export function resetTasksToEditReadme(): void {
  const tasks = getTasks();
  const engineers = getEngineers();
  
  // Clear all existing tasks
  saveTasks([]);
  
  // Create a single "edit README" task
  // Assign to first engineer if available, otherwise null
  const firstEngineer = engineers.length > 0 ? engineers[0] : null;
  
  const editReadmeTask: Task = {
    id: generateId(),
    description: "edit README",
    engineer_id: firstEngineer?.id || null,
    status: "pending",
    output: null,
    created_at: new Date().toISOString(),
  };
  
  saveTask(editReadmeTask);
}

