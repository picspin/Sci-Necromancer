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
              <input
                type="text"
                id="google-text-model"
                v-model="localSettings.model"
                placeholder="gemini-2.5-flash"
                class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
            </div>

            <div>
              <label
                for="google-image-model"
                class="block text-sm font-medium text-text-secondary mb-1"
              >
                Image Model
              </label>
              <input
                type="text"
                id="google-image-model"
                v-model="localSettings.openAIImageModel"
                placeholder="imagen-3.0-generate-001"
                class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
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
            <input
              type="text"
              id="openai-base-url"
              v-model="localSettings.openAIBaseUrl"
              placeholder="https://api.openai.com/v1"
              class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
            />
            <p class="text-xs text-text-secondary mt-1">Support OpenAI API based Providers</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label for="text-model" class="block text-sm font-medium text-text-secondary mb-1">
                Text Model
              </label>
              <input
                type="text"
                id="text-model"
                v-model="localSettings.openAITextModel"
                placeholder="gpt-4o"
                class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
            </div>

            <div>
              <label for="vision-model" class="block text-sm font-medium text-text-secondary mb-1">
                Vision Model
              </label>
              <input
                type="text"
                id="vision-model"
                v-model="localSettings.openAIVisionModel"
                placeholder="gpt-4o, gpt-4-vision-preview"
                class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
              <p class="text-xs text-text-secondary mt-1">For analyzing uploaded images</p>
            </div>

            <div>
              <label for="image-model" class="block text-sm font-medium text-text-secondary mb-1">
                Image Model
              </label>
              <input
                type="text"
                id="image-model"
                v-model="localSettings.openAIImageModel"
                placeholder="dall-e-3, gpt-5"
                class="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
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
              <h4 class="text-sm font-medium text-text-primary">Image Generation</h4>
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
import Modal from '@/components/ui/Modal.vue';
import { useSettings } from '@/composables/useSettings';
import type { AIProvider, Settings } from '@/types';

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

const handleSave = () => {
  saveSettings(localSettings.value);
  emit('close');
};
</script>
