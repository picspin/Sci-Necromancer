/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Backend API base URL (Vercel serverless)
   * Example: https://sci-necromancer-api.vercel.app
   * If not set, defaults to same origin (for local dev)
   */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
