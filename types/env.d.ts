/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Google AI API key(s) for Nanobana Pro image generation
   * Supports multiple comma-separated keys for automatic fallback:
   * VITE_NANOBANA_API_KEY=key1,key2,key3
   * When one key hits quota limit (429), the next key is automatically used.
   */
  readonly VITE_NANOBANA_API_KEY: string;
  /**
   * Optional: Override the Gemini model for image generation
   * Default: gemini-3-pro-image-preview (highest quality)
   */
  readonly VITE_NANOBANA_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
