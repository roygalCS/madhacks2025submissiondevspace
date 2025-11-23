// This file automatically falls back to localStorage when Supabase is unavailable
// Perfect for demos when Supabase is down!

import { supabase as localStorageSupabase, testSupabaseConnection as testLocalStorageConnection } from '../localstorage/client';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Check if we should use localStorage (when Supabase is down or not configured)
const shouldUseLocalStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  
  // Force localStorage mode via browser console: localStorage.setItem('devspace-use-localstorage', 'true')
  if (localStorage.getItem('devspace-use-localstorage') === 'true') {
    console.log('🔧 Using localStorage mode (forced)');
    return true;
  }
  
  // Auto-use localStorage if Supabase config is missing
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.log('🔧 Using localStorage mode (no Supabase config)');
    // Set flag so it persists
    localStorage.setItem('devspace-use-localstorage', 'true');
    return true;
  }
  
  return false;
};

// Check localStorage flag on every access (allows dynamic switching)
const isLocalStorageForced = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('devspace-use-localstorage') === 'true';
  }
  return false;
};

let USE_LOCALSTORAGE = shouldUseLocalStorage() || isLocalStorageForced();

// Create real Supabase client if we have config
let realSupabase: any = null;
if (!USE_LOCALSTORAGE && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
  try {
    realSupabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          storage: localStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        global: {
          headers: {
            'x-client-info': 'devspace-ai-co-pilot',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        },
        db: {
          schema: 'public',
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );
  } catch (error) {
    console.warn('⚠️ Failed to create Supabase client, using localStorage:', error);
    USE_LOCALSTORAGE = true;
  }
}

// Function to get the right client (checks localStorage flag dynamically)
function getSupabaseClient() {
  // Always check localStorage flag (allows switching at runtime)
  if (isLocalStorageForced() || USE_LOCALSTORAGE || !realSupabase) {
    return localStorageSupabase;
  }
  return realSupabase;
}

// Export the appropriate client (will use localStorage if Supabase fails)
// Use a getter so it checks localStorage flag on each access
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    const client = getSupabaseClient();
    return client[prop];
  }
});

// Connection test - automatically switches to localStorage on failure
export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
  // If using localStorage or forced, always succeed
  if (isLocalStorageForced() || USE_LOCALSTORAGE || !realSupabase) {
    return { success: true };
  }

  // If we have realSupabase, test it
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    // No config, use localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('devspace-use-localstorage', 'true');
    }
    return { success: true };
  }

  try {
    const healthCheckUrl = `${SUPABASE_URL}/rest/v1/`;
    const isNewFormat = SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_');
    const headers: Record<string, string> = {
      'apikey': SUPABASE_PUBLISHABLE_KEY,
    };
    
    if (!isNewFormat && SUPABASE_PUBLISHABLE_KEY?.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
    }
    
    const fetchTest = await fetch(healthCheckUrl, {
      method: 'GET',
      headers,
      mode: 'cors',
    });

    // If we get 401 or other errors, automatically switch to localStorage
    if (fetchTest.status === 401 || (!fetchTest.ok && fetchTest.status !== 404)) {
      console.warn('⚠️ Supabase unavailable (status ' + fetchTest.status + '), automatically switching to localStorage mode');
      // Force localStorage mode
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('devspace-use-localstorage', 'true');
        USE_LOCALSTORAGE = true;
      }
      return { success: true }; // Return success because localStorage will work
    }

    // Test actual query
    const { error } = await realSupabase
      .from('engineers')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('⚠️ Supabase query failed, automatically switching to localStorage mode');
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('devspace-use-localstorage', 'true');
        USE_LOCALSTORAGE = true;
      }
      return { success: true }; // Return success because localStorage will work
    }

    return { success: true };
  } catch (err) {
    // Network error - automatically fall back to localStorage
    console.warn('⚠️ Supabase network error, automatically switching to localStorage mode:', err);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('devspace-use-localstorage', 'true');
      USE_LOCALSTORAGE = true;
    }
    return { success: true }; // Return success because localStorage will work
  }
}

// Log which mode we're using
if (USE_LOCALSTORAGE || !realSupabase || isLocalStorageForced()) {
  console.log('✅ Using localStorage database (works offline, perfect for demos)');
  console.log('💡 To switch to Supabase, remove localStorage item: devspace-use-localstorage');
} else {
  console.log('✅ Using Supabase database');
}
