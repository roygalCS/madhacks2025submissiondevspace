/**
 * LocalStorage-based replacement for Supabase
 * Perfect for demos when Supabase is down or unavailable
 * Mimics Supabase API for minimal code changes
 */

// Mock user for demo purposes
const DEMO_USER_ID = 'demo-user-' + Date.now();
const DEMO_USER_EMAIL = 'demo@devspace.ai';

// Database schema stored in localStorage
interface Database {
  engineers: Engineer[];
  tasks: Task[];
  connections: Connection[];
}

interface Engineer {
  id: string;
  user_id: string;
  name: string;
  personality: string | null;
  avatar_url: string | null;
  fish_voice_id: string | null;
  specialty: string | null;
  created_at: string;
}

interface Task {
  id: string;
  user_id: string;
  description: string;
  engineer_id: string | null;
  status: string;
  output: string | null;
  created_at: string;
}

interface Connection {
  id: string;
  user_id: string;
  github_token: string | null;
  github_username: string | null;
  github_repo_name: string | null;
  base_branch: string | null;
  created_at: string;
  updated_at: string;
}

// Initialize database in localStorage
function initDatabase() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const db = localStorage.getItem('devspace-db');
  if (!db) {
    const initialDb: Database = {
      engineers: [],
      tasks: [],
      connections: [],
    };
    localStorage.setItem('devspace-db', JSON.stringify(initialDb));
  }
}

// Get database from localStorage
function getDatabase(): Database {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { engineers: [], tasks: [], connections: [] };
  }
  initDatabase();
  const db = localStorage.getItem('devspace-db');
  return db ? JSON.parse(db) : { engineers: [], tasks: [], connections: [] };
}

// Save database to localStorage
function saveDatabase(db: Database) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.setItem('devspace-db', JSON.stringify(db));
}

// Query builder helper
class QueryBuilder {
  private filtered: any[];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitNum: number | null = null;

  constructor(items: any[]) {
    this.filtered = [...items];
  }

  eq(column: string, value: any): this {
    this.filtered = this.filtered.filter((item: any) => item[column] === value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(num: number): this {
    this.limitNum = num;
    return this;
  }

  async execute(): Promise<{ data: any[]; error: null }> {
    let result = this.filtered;
    
    if (this.orderBy) {
      result = result.sort((a: any, b: any) => {
        const aVal = a[this.orderBy!.column];
        const bVal = b[this.orderBy!.column];
        if (aVal < bVal) return this.orderBy!.ascending ? -1 : 1;
        if (aVal > bVal) return this.orderBy!.ascending ? 1 : -1;
        return 0;
      });
    }
    
    if (this.limitNum !== null) {
      result = result.slice(0, this.limitNum);
    }
    
    return { data: result, error: null };
  }

  async maybeSingle(): Promise<{ data: any | null; error: null }> {
    const { data } = await this.execute();
    return { data: data[0] || null, error: null };
  }

  async single(): Promise<{ data: any | null; error: null }> {
    const { data } = await this.execute();
    return { data: data[0] || null, error: null };
  }

  // Make it thenable (Promise-like)
  then(resolve: any, reject?: any): Promise<any> {
    return this.execute().then(resolve, reject);
  }
}

// Mock Supabase client
export const supabase = {
  auth: {
    getSession: async () => {
      if (typeof window === 'undefined' || !window.localStorage) {
        return { data: { session: null }, error: null };
      }
      const session = localStorage.getItem('devspace-session');
      const email = localStorage.getItem('devspace-user-email') || DEMO_USER_EMAIL;
      if (session) {
        return {
          data: {
            session: {
              user: {
                id: DEMO_USER_ID,
                email: email,
              },
            },
          },
          error: null,
        };
      }
      return { data: { session: null }, error: null };
    },
    getUser: async () => {
      if (typeof window === 'undefined' || !window.localStorage) {
        return { data: { user: null }, error: null };
      }
      const session = localStorage.getItem('devspace-session');
      const email = localStorage.getItem('devspace-user-email') || DEMO_USER_EMAIL;
      if (session) {
        return {
          data: {
            user: {
              id: DEMO_USER_ID,
              email: email,
            },
          },
          error: null,
        };
      }
      return { data: { user: null }, error: null };
    },
    signUp: async ({ email, password }: { email: string; password: string }) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('devspace-session', 'true');
        localStorage.setItem('devspace-user-email', email);
      }
      // Trigger auth state change immediately
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('storage'));
        }
      }, 50);
      return {
        data: {
          user: { id: DEMO_USER_ID, email },
          session: { user: { id: DEMO_USER_ID, email } },
        },
        error: null,
      };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('devspace-session', 'true');
        localStorage.setItem('devspace-user-email', email);
      }
      // Trigger auth state change immediately
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('storage'));
        }
      }, 50);
      return {
        data: {
          user: { id: DEMO_USER_ID, email },
          session: { user: { id: DEMO_USER_ID, email } },
        },
        error: null,
      };
    },
    signOut: async () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('devspace-session');
      }
      return { error: null };
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      // Mock subscription - trigger callback immediately if session exists
      if (typeof window !== 'undefined' && window.localStorage) {
        const checkSession = () => {
          const session = localStorage.getItem('devspace-session');
          const email = localStorage.getItem('devspace-user-email') || DEMO_USER_EMAIL;
          return { session, email };
        };
        
        const current = checkSession();
        if (current.session) {
          // Trigger immediately for existing session
          setTimeout(() => {
            callback('SIGNED_IN', { user: { id: DEMO_USER_ID, email: current.email } });
          }, 100);
        }
        
        // Listen for storage changes (when sign in happens)
        const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'devspace-session' && e.newValue) {
            const email = localStorage.getItem('devspace-user-email') || DEMO_USER_EMAIL;
            callback('SIGNED_IN', { user: { id: DEMO_USER_ID, email } });
          } else if (e.key === 'devspace-session' && !e.newValue) {
            callback('SIGNED_OUT', null);
          }
        };
        
        // Listen for storage events (works across tabs)
        window.addEventListener('storage', handleStorageChange);
        
        // Also poll for changes (since storage events don't fire in same tab)
        let lastSession = current.session;
        const pollInterval = setInterval(() => {
          const current = checkSession();
          if (current.session && !lastSession) {
            callback('SIGNED_IN', { user: { id: DEMO_USER_ID, email: current.email } });
            lastSession = current.session;
          } else if (!current.session && lastSession) {
            callback('SIGNED_OUT', null);
            lastSession = null;
          }
        }, 300);
        
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                window.removeEventListener('storage', handleStorageChange);
                clearInterval(pollInterval);
              },
            },
          },
        };
      }
      
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },
  },
  from: (table: 'engineers' | 'tasks' | 'connections') => {
    const db = getDatabase();
    
    return {
      select: (columns: string) => {
        const builder = new QueryBuilder(db[table]);
        return builder;
      },
      insert: (data: any | any[]) => ({
        select: async (columns?: string) => {
          const items = Array.isArray(data) ? data : [data];
          const newItems = items.map((item) => ({
            id: item.id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...item,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
          }));
          db[table].push(...newItems);
          saveDatabase(db);
          return { data: newItems, error: null };
        },
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => async () => {
          const index = db[table].findIndex((item: any) => item[column] === value);
          if (index !== -1) {
            db[table][index] = { ...db[table][index], ...data, updated_at: new Date().toISOString() };
            saveDatabase(db);
            return { data: db[table][index], error: null };
          }
          return { data: null, error: { message: 'Not found' } };
        },
      }),
      delete: () => ({
        eq: (column: string, value: any) => async () => {
          const index = db[table].findIndex((item: any) => item[column] === value);
          if (index !== -1) {
            db[table].splice(index, 1);
            saveDatabase(db);
            return { data: null, error: null };
          }
          return { data: null, error: { message: 'Not found' } };
        },
      }),
    };
  },
};

// Connection test (always succeeds for localStorage)
export async function testSupabaseConnection() {
  return { success: true };
}

// Initialize on import (only in browser)
if (typeof window !== 'undefined' && window.localStorage) {
  initDatabase();
}
