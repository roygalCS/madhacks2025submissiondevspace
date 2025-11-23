/// <reference types="vite/client" />

interface ImportMetaEnv {
  // FishAudio API (REQUIRED)
  readonly VITE_FISHAUDIO_API_KEY: string;
  readonly VITE_FISHAUDIO_DEFAULT_VOICE_ID?: string;

  // Supabase (REQUIRED)
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;

  // Windmill (REQUIRED)
  readonly VITE_WINDMILL_API_KEY: string;
  readonly VITE_WINDMILL_BASE_URL?: string;

  // GitHub OAuth (REQUIRED)
  readonly VITE_GITHUB_CLIENT_ID: string;
  readonly VITE_GITHUB_CLIENT_SECRET?: string;

  // Supabase Edge Function for LLM (OPTIONAL)
  readonly VITE_SUPABASE_LLM_FUNCTION?: string;
  readonly VITE_LLM_MODEL?: string;
  readonly VITE_LLM_TEMPERATURE?: string;
  readonly VITE_LLM_MAX_TOKENS?: string;

  // Optional: Default avatar URLs
  readonly VITE_DEFAULT_AVATAR_URL?: string;
  readonly VITE_AVATAR_1_URL?: string;
  readonly VITE_AVATAR_2_URL?: string;
  readonly VITE_AVATAR_3_URL?: string;
  readonly VITE_AVATAR_4_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
