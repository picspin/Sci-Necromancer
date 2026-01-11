<template>
  <Modal @close="$emit('close')" title="Model Manager" size="lg">
    <div class="space-y-6">
      <!-- Panel Navigation -->
      <div class="flex gap-2 border-b border-base-300">
        <button
          @click="activePanel = 'providers'"
          :class="[
            'px-4 py-2 text-sm font-medium transition-colors border-b-2',
            activePanel === 'providers'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary',
          ]"
        >
          AI Providers
        </button>
        <button
          @click="activePanel = 'mcp-tools'"
          :class="[
            'px-4 py-2 text-sm font-medium transition-colors border-b-2',
            activePanel === 'mcp-tools'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary',
          ]"
        >
          MCP Tools
        </button>
      </div>

      <!-- AI Providers Panel -->
      <div v-if="activePanel === 'providers'" class="space-y-4">
        <!-- Provider Selection -->
        <div class="space-y-3">
          <label class="block text-sm font-medium text-text-primary">AI Provider</label>
          <div class="flex gap-3">
            <button
              @click="handleProviderChange('google')"
              :class="[
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200',
                localSettings.provider === 'google'
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'bg-base-200 text-text-secondary hover:bg-base-300',
              ]"
            >
              Google AI
            </button>
            <button
              @click="handleProviderChange('openai')"
              :class="[
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200',
                localSettings.provider === 'openai'
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'bg-base-200 text-text-secondary hover:bg-base-300',
              ]"
            >
              OpenAI Compatible
            </button>
          </div>
        </div>

        <!-- Google AI Configuration -->
        <div
          v-if="localSettings.provider === 'google'"
          class="space-y-4 p-4 bg-base-100 rounded-lg"
        >
          <div>
            <label for="google-api-key" class="block text-sm font-medium text-text-secondary mb-1">
              API Key
            </label>
            <input
              type="password"
              id="google-api-key"
              v-model="localSettings.googleApiKey"
              placeholder="AIza..."
              class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
            />
            <p class="text-xs text-text-secondary mt-1">Get your API key from Google AI Studio</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                for="google-text-model"
                class="block text-sm font-medium text-text-secondary mb-1"
              >
                Text Model
              </label>
              <div class="flex items-center gap-2">
                <template v-if="googleModelIds.length">
                  <select
                    id="google-text-model"
                    v-model="localSettings.model"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  >
                    <option v-for="m in googleModelIds" :key="m" :value="m">{{ m }}</option>
                  </select>
                </template>
                <template v-else>
                  <select
                    id="google-text-model"
                    v-model="localSettings.model"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                  </select>
                </template>
                <button
                  type="button"
                  @click="loadGoogleModels"
                  class="p-2 bg-base-300 text-text-secondary rounded-md hover:bg-base-400 transition-colors flex items-center justify-center"
                  :disabled="loadingGoogleModels"
                  :title="t('model_manager.load_models')"
                >
                  <svg
                    :class="['w-5 h-5', loadingGoogleModels ? 'animate-spin' : '']"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label
                for="google-image-model"
                class="block text-sm font-medium text-text-secondary mb-1"
              >
                Image Model
              </label>
              <div class="flex items-center gap-2">
                <template v-if="googleImageModelIds.length">
                  <select
                    id="google-image-model"
                    v-model="localSettings.openAIImageModel"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  >
                    <option v-for="m in googleImageModelIds" :key="m" :value="m">{{ m }}</option>
                  </select>
                </template>
                <template v-else>
                  <select
                    id="google-image-model"
                    v-model="localSettings.openAIImageModel"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  >
                    <option value="imagen-3.0-generate-001">imagen-3.0-generate-001</option>
                  </select>
                </template>
                <button
                  type="button"
                  @click="loadGoogleModels"
                  class="p-2 bg-base-300 text-text-secondary rounded-md hover:bg-base-400 transition-colors flex items-center justify-center"
                  :disabled="loadingGoogleModels"
                  :title="t('model_manager.load_models')"
                >
                  <svg
                    :class="['w-5 h-5', loadingGoogleModels ? 'animate-spin' : '']"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- OpenAI Compatible Configuration -->
        <div
          v-if="localSettings.provider === 'openai'"
          class="space-y-4 p-4 bg-base-100 rounded-lg"
        >
          <div>
            <label for="openai-api-key" class="block text-sm font-medium text-text-secondary mb-1">
              API Key
            </label>
            <input
              type="password"
              id="openai-api-key"
              v-model="localSettings.openAIApiKey"
              placeholder="sk-... or provider-specific key"
              class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
            />
          </div>

          <div>
            <label for="openai-base-url" class="block text-sm font-medium text-text-secondary mb-1">
              Base URL
            </label>
            <div class="flex items-center gap-2">
              <input
                type="text"
                id="openai-base-url"
                v-model="localSettings.openAIBaseUrl"
                placeholder="https://api.openai.com/v1"
                class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
              <button
                type="button"
                @click="loadOpenAIModels"
                class="px-3 py-2 bg-brand-primary text-white rounded-md text-sm hover:bg-brand-secondary transition-colors"
                :disabled="loadingModels"
              >
                {{ loadingModels ? 'Loading...' : t('model_manager.load_models') }}
              </button>
            </div>
            <p class="text-xs text-text-secondary mt-1">Support OpenAI API based Providers</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label for="text-model" class="block text-sm font-medium text-text-secondary mb-1">
                Text Model
              </label>
              <div class="flex items-center gap-2">
                <template v-if="openAIModelIds.length">
                  <select
                    id="text-model"
                    v-model="localSettings.openAITextModel"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  >
                    <option v-for="m in openAIModelIds" :key="m" :value="m">{{ m }}</option>
                  </select>
                </template>
                <template v-else>
                  <input
                    type="text"
                    id="text-model"
                    v-model="localSettings.openAITextModel"
                    placeholder="gpt-4o"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  />
                </template>
                <button
                  type="button"
                  @click="loadOpenAIModels"
                  class="p-2 bg-base-300 text-text-secondary rounded-md hover:bg-base-400 transition-colors flex items-center justify-center"
                  :disabled="loadingModels"
                  :title="t('model_manager.load_models')"
                >
                  <svg
                    :class="['w-5 h-5', loadingModels ? 'animate-spin' : '']"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label for="vision-model" class="block text-sm font-medium text-text-secondary mb-1">
                Vision Model
              </label>
              <div class="flex items-center gap-2">
                <template v-if="openAIModelIds.length">
                  <select
                    id="vision-model"
                    v-model="localSettings.openAIVisionModel"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  >
                    <option v-for="m in openAIModelIds" :key="m" :value="m">{{ m }}</option>
                  </select>
                </template>
                <template v-else>
                  <input
                    type="text"
                    id="vision-model"
                    v-model="localSettings.openAIVisionModel"
                    placeholder="gpt-4o, gpt-4-vision-preview"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  />
                </template>
                <button
                  type="button"
                  @click="loadOpenAIModels"
                  class="p-2 bg-base-300 text-text-secondary rounded-md hover:bg-base-400 transition-colors flex items-center justify-center"
                  :disabled="loadingModels"
                  :title="t('model_manager.load_models')"
                >
                  <svg
                    :class="['w-5 h-5', loadingModels ? 'animate-spin' : '']"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
              <p class="text-xs text-text-secondary mt-1">For analyzing uploaded images</p>
            </div>

            <div>
              <label for="image-model" class="block text-sm font-medium text-text-secondary mb-1">
                Image Model
              </label>
              <div class="flex items-center gap-2">
                <template v-if="openAIModelIds.length">
                  <select
                    id="image-model"
                    v-model="localSettings.openAIImageModel"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  >
                    <option v-for="m in openAIModelIds" :key="m" :value="m">{{ m }}</option>
                  </select>
                </template>
                <template v-else>
                  <input
                    type="text"
                    id="image-model"
                    v-model="localSettings.openAIImageModel"
                    placeholder="dall-e-3, gpt-5"
                    class="flex-1 p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                  />
                </template>
                <button
                  type="button"
                  @click="loadOpenAIModels"
                  class="p-2 bg-base-300 text-text-secondary rounded-md hover:bg-base-400 transition-colors flex items-center justify-center"
                  :disabled="loadingModels"
                  :title="t('model_manager.load_models')"
                >
                  <svg
                    :class="['w-5 h-5', loadingModels ? 'animate-spin' : '']"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
              <p class="text-xs text-text-secondary mt-1">For generating/editing images</p>
            </div>
          </div>
        </div>
      </div>

      <!-- MCP Tools Panel -->
      <div v-if="activePanel === 'mcp-tools'" class="space-y-4">
        <p class="text-sm text-text-secondary">
          Configure Model Context Protocol (MCP) tools for extended functionality
        </p>

        <!-- Supabase MCP -->
        <div class="p-4 bg-base-100 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="text-sm font-medium text-text-primary">Supabase Database</h4>
              <p class="text-xs text-text-secondary mt-0.5">Cloud sync and storage</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="localSettings.databaseEnabled" class="sr-only peer" />
              <div
                class="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"
              ></div>
            </label>
          </div>
        </div>

        <!-- Image Generation MCP -->
        <div class="p-4 bg-base-100 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="text-sm font-medium text-text-primary">Image Generation (MCP)</h4>
              <p class="text-xs text-text-secondary mt-0.5">Generate images via MCP tool calls</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="localSettings.mcpConfig?.imageGeneration?.enabled || false"
                @change="toggleImageGeneration"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"
              ></div>
            </label>
          </div>

          <div
            v-if="localSettings.mcpConfig?.imageGeneration?.enabled"
            class="space-y-3 pt-3 border-t border-base-300"
          >
            <div>
              <label
                for="mcp-image-base-url"
                class="block text-sm font-medium text-text-secondary mb-1"
              >
                Base URL
              </label>
              <input
                type="text"
                id="mcp-image-base-url"
                v-model="mcpImageConfig.baseUrl"
                placeholder="https://chat.int.bayer.com/api/v2"
                class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
              <p class="text-xs text-text-secondary mt-1">MCP endpoint for image generation</p>
            </div>

            <div>
              <label
                for="mcp-image-model"
                class="block text-sm font-medium text-text-secondary mb-1"
              >
                Model
              </label>
              <input
                type="text"
                id="mcp-image-model"
                v-model="mcpImageConfig.model"
                placeholder="gpt-4o (model with tool access)"
                class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
              <p class="text-xs text-text-secondary mt-1">
                Model that has access to image generation tools
              </p>
            </div>

            <div>
              <label
                for="mcp-image-config"
                class="block text-sm font-medium text-text-secondary mb-1"
              >
                Custom Configuration (JSON)
              </label>
              <textarea
                id="mcp-image-config"
                v-model="mcpImageConfig.customConfig"
                placeholder='{"customHeaders": {"X-Custom": "value"}}'
                class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                rows="3"
              ></textarea>
              <p class="text-xs text-text-secondary mt-1">
                Optional: Custom headers or tool-specific configuration
              </p>
            </div>
          </div>
        </div>

        <!-- Nanobana Pro 3 Info (Environment-based) -->
        <div class="p-4 bg-base-100 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-orange-500 text-lg">🍌</span>
            <h4 class="text-sm font-medium text-text-primary">Nanobana Pro 3</h4>
          </div>
          <p class="text-xs text-text-secondary">
            Google Gemini image generation is configured via environment variables. Set
            <code class="bg-base-300 px-1 rounded">VITE_NANOBANA_API_KEY</code> in your
            <code class="bg-base-300 px-1 rounded">.env</code> file.
          </p>
          <p class="text-xs text-text-secondary mt-1">
            Get your API key from
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              class="text-brand-primary hover:underline"
              >Google AI Studio</a
            >
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end gap-3 pt-4 border-t border-base-300">
        <button
          @click="$emit('close')"
          class="px-4 py-2 rounded-md text-text-secondary hover:bg-base-300 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="handleSave"
          class="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-secondary text-white font-semibold transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import { useSettings } from '@/composables/useSettings';
import type { AIProvider, Settings } from '@/types';

const { t } = useI18n();

const emit = defineEmits<{
  close: [];
}>();

const { settings, saveSettings } = useSettings();

type ConfigPanel = 'providers' | 'mcp-tools';

// Local state
const activePanel = ref<ConfigPanel>('providers');
const localSettings = ref<Settings>({ ...settings.value });

// MCP Image Generation Config (reactive helper)
const mcpImageConfig = computed({
  get: () =>
    localSettings.value.mcpConfig?.imageGeneration || {
      enabled: false,
      baseUrl: '',
      model: '',
      customConfig: '',
    },
  set: (value) => {
    localSettings.value = {
      ...localSettings.value,
      mcpConfig: {
        ...localSettings.value.mcpConfig,
        imageGeneration: value,
      },
    };
  },
});

// Watch for external settings changes
watch(
  settings,
  (newSettings) => {
    localSettings.value = { ...newSettings };
  },
  { deep: true }
);

const handleProviderChange = (provider: AIProvider) => {
  localSettings.value = { ...localSettings.value, provider };
};

const toggleImageGeneration = (e: Event) => {
  const target = e.target as HTMLInputElement;
  localSettings.value = {
    ...localSettings.value,
    mcpConfig: {
      ...localSettings.value.mcpConfig,
      imageGeneration: {
        enabled: target.checked,
        baseUrl:
          localSettings.value.mcpConfig?.imageGeneration?.baseUrl ||
          'https://chat.int.bayer.com/api/v2',
        model: localSettings.value.mcpConfig?.imageGeneration?.model || '',
        customConfig: localSettings.value.mcpConfig?.imageGeneration?.customConfig || '',
      },
    },
  };
};

const loadingModels = ref(false);
const openAIModelIds = ref<string[]>([]);
const loadingGoogleModels = ref(false);
const googleModelIds = ref<string[]>([]);
const googleImageModelIds = ref<string[]>([]);

const loadOpenAIModels = async () => {
  try {
    loadingModels.value = true;
    const base = (localSettings.value.openAIBaseUrl || '').replace(/\/$/, '');
    const url = `${base}/models`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localSettings.value.openAIApiKey || ''}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to load models: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const list: string[] = Array.isArray(data?.data)
      ? data.data.map((m: any) => m.id).filter((id: any) => typeof id === 'string')
      : [];
    openAIModelIds.value = list;
  } catch (e) {
    console.warn('Load models error:', e);
    openAIModelIds.value = [];
  } finally {
    loadingModels.value = false;
  }
};

const loadGoogleModels = async () => {
  try {
    loadingGoogleModels.value = true;
    const apiKey = localSettings.value.googleApiKey;
    if (!apiKey) {
      console.warn('No Google API key provided');
      return;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load Google models: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const models: string[] = Array.isArray(data?.models)
      ? data.models
          .map((m: any) => m.name?.replace('models/', '') || '')
          .filter((name: string) => name.length > 0)
      : [];
    // Separate text models (gemini) and image models (imagen)
    googleModelIds.value = models.filter((m) => m.includes('gemini'));
    googleImageModelIds.value = models.filter((m) => m.includes('imagen'));
  } catch (e) {
    console.warn('Load Google models error:', e);
    googleModelIds.value = [];
    googleImageModelIds.value = [];
  } finally {
    loadingGoogleModels.value = false;
  }
};

const handleSave = () => {
  saveSettings(localSettings.value);
  emit('close');
};
</script>
