<template>
  <Modal @close="$emit('close')" :title="t('model_manager.title')" size="lg">
    <div class="space-y-5">
      <nav class="grid grid-cols-3 gap-2" :aria-label="t('model_manager.title')">
        <button
          v-for="panel in panels"
          :key="panel.id"
          type="button"
          @click="activePanel = panel.id"
          :class="[
            'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            activePanel === panel.id
              ? 'bg-brand-primary text-white'
              : 'bg-base-100 text-text-secondary hover:text-text-primary',
          ]"
        >
          {{ t(panel.label) }}
        </button>
      </nav>

      <section v-if="activePanel === 'personal-api'" class="space-y-4">
        <p class="text-sm text-text-secondary">{{ t('model_manager.personal_api_help') }}</p>
        <div class="grid gap-2 sm:grid-cols-3">
          <button
            v-for="provider in providerOptions"
            :key="provider.id"
            type="button"
            @click="localSettings.provider = provider.id"
            :class="[
              'rounded-lg px-4 py-2 text-sm font-medium',
              localSettings.provider === provider.id
                ? 'bg-brand-primary text-white'
                : 'bg-base-100 text-text-secondary',
            ]"
          >
            {{ t(provider.label) }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded-lg bg-base-100 px-3 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
            :disabled="isLoadingModels"
            @click="loadModels"
          >
            {{
              isLoadingModels ? t('model_manager.loading_models') : t('model_manager.load_models')
            }}
          </button>
          <p
            v-if="modelLoadMessage"
            class="text-xs"
            :class="modelLoadError ? 'text-red-400' : 'text-emerald-400'"
          >
            {{ modelLoadMessage }}
          </p>
        </div>

        <div
          v-if="localSettings.provider === 'google'"
          class="grid gap-3 rounded-lg bg-base-100 p-4 sm:grid-cols-2"
        >
          <label class="sm:col-span-2">
            <span class="field-label">{{ t('model_manager.api_key') }}</span>
            <input
              v-model="localSettings.googleApiKey"
              type="password"
              class="field-input"
              autocomplete="off"
            />
          </label>
          <label>
            <span class="field-label">{{ t('model_manager.text_model') }}</span>
            <input
              v-model="localSettings.model"
              type="text"
              class="field-input"
              list="text-model-options"
              placeholder="gemini-3.6-flash"
            />
          </label>
          <label>
            <span class="field-label">{{ t('model_manager.image_model') }}</span>
            <input
              v-model="localSettings.googleImageModel"
              type="text"
              class="field-input"
              list="image-model-options"
              placeholder="gemini-3-pro-image"
            />
          </label>
        </div>

        <div
          v-else-if="localSettings.provider === 'openai'"
          class="grid gap-3 rounded-lg bg-base-100 p-4 sm:grid-cols-2"
        >
          <label class="sm:col-span-2">
            <span class="field-label">{{ t('model_manager.api_key') }}</span>
            <input
              v-model="localSettings.openAIApiKey"
              type="password"
              class="field-input"
              autocomplete="off"
            />
          </label>
          <label class="sm:col-span-2">
            <span class="field-label">{{ t('model_manager.base_url') }}</span>
            <input
              v-model="localSettings.openAIBaseUrl"
              type="url"
              class="field-input"
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label>
            <span class="field-label">{{ t('model_manager.text_model') }}</span>
            <input
              v-model="localSettings.openAITextModel"
              type="text"
              class="field-input"
              list="text-model-options"
              placeholder="gpt-5"
            />
          </label>
          <label>
            <span class="field-label">{{ t('model_manager.image_model') }}</span>
            <input
              v-model="localSettings.openAIImageModel"
              type="text"
              class="field-input"
              list="image-model-options"
              placeholder="gpt-image-1"
            />
          </label>
        </div>

        <div v-else class="grid gap-3 rounded-lg bg-base-100 p-4 sm:grid-cols-2">
          <label class="sm:col-span-2">
            <span class="field-label">{{ t('model_manager.api_key') }}</span>
            <input
              v-model="localSettings.anthropicApiKey"
              type="password"
              class="field-input"
              autocomplete="off"
            />
          </label>
          <label class="sm:col-span-2">
            <span class="field-label">{{ t('model_manager.base_url') }}</span>
            <input
              v-model="localSettings.anthropicBaseUrl"
              type="url"
              class="field-input"
              placeholder="https://api.anthropic.com"
            />
          </label>
          <label class="sm:col-span-2">
            <span class="field-label">{{ t('model_manager.text_model') }}</span>
            <input
              v-model="localSettings.anthropicTextModel"
              type="text"
              class="field-input"
              list="text-model-options"
              placeholder="claude-sonnet"
            />
          </label>
        </div>

        <datalist id="text-model-options">
          <option v-for="model in modelCatalog.text" :key="model" :value="model" />
        </datalist>
        <datalist id="image-model-options">
          <option v-for="model in modelCatalog.image" :key="model" :value="model" />
        </datalist>
      </section>

      <section v-else-if="activePanel === 'member-services'" class="space-y-3">
        <MemberAccount />
        <div class="rounded-lg border border-base-300 bg-base-100 p-4 text-sm text-text-secondary">
          <h3 class="font-semibold text-text-primary">
            {{ t('model_manager.member_benefits_title') }}
          </h3>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-xs">
            <li>{{ t('model_manager.member_rule_signup') }}</li>
            <li>{{ t('model_manager.member_rule_checkin') }}</li>
            <li>{{ t('model_manager.member_rule_abstract') }}</li>
            <li>{{ t('model_manager.member_rule_image') }}</li>
            <li>{{ t('model_manager.member_rule_storage') }}</li>
          </ul>
        </div>
        <label class="setting-row">
          <span>
            <strong>Gemini 3.6 Flash</strong>
            <small>{{ t('model_manager.managed_text_help') }}</small>
          </span>
          <input
            v-model="localSettings.memberManagedTextEnabled"
            type="checkbox"
            :disabled="!isAuthenticated"
            aria-label="Gemini 3.6 Flash"
            class="setting-checkbox"
          />
        </label>
        <label class="setting-row">
          <span>
            <strong>Nano Banana Pro</strong>
            <small>{{ t('model_manager.managed_image_help') }}</small>
          </span>
          <input
            v-model="localSettings.memberManagedNanoBananaEnabled"
            type="checkbox"
            :disabled="!isAuthenticated"
            aria-label="Nano Banana Pro"
            class="setting-checkbox"
          />
        </label>
        <label class="setting-row">
          <span>
            <strong>GPT Image</strong>
            <small>{{ t('model_manager.managed_image_help') }}</small>
          </span>
          <input
            v-model="localSettings.memberManagedGptImageEnabled"
            type="checkbox"
            :disabled="!isAuthenticated"
            aria-label="GPT Image"
            class="setting-checkbox"
          />
        </label>
        <label class="setting-row">
          <span>
            <strong>Supabase cloud save</strong>
            <small>{{ t('model_manager.cloud_save_help') }}</small>
          </span>
          <input
            v-model="localSettings.databaseEnabled"
            type="checkbox"
            :disabled="!isAuthenticated"
            aria-label="Supabase cloud save"
            class="setting-checkbox"
          />
        </label>
      </section>

      <section v-else class="space-y-4">
        <p class="text-sm text-text-secondary">{{ t('model_manager.mcp_description') }}</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="setting-row">
            <span
              ><strong>{{ t('model_manager.skills_runtime') }}</strong></span
            >
            <input
              v-model="localSettings.capabilities!.skillsEnabled"
              type="checkbox"
              :aria-label="t('model_manager.skills_runtime')"
              class="setting-checkbox"
            />
          </label>
          <label class="setting-row">
            <span
              ><strong>{{ t('model_manager.mcp_runtime') }}</strong></span
            >
            <input
              v-model="localSettings.capabilities!.mcpEnabled"
              type="checkbox"
              :aria-label="t('model_manager.mcp_runtime')"
              class="setting-checkbox"
            />
          </label>
        </div>

        <div class="rounded-lg bg-base-100 p-4 space-y-3">
          <label class="setting-row !p-0">
            <span>
              <strong>{{ t('model_manager.bundled_skill') }}</strong>
              <small>{{ t('model_manager.bundled_skill_help') }}</small>
            </span>
            <input
              v-model="localSettings.capabilities!.bundledBlindReviewSkill"
              type="checkbox"
              class="setting-checkbox"
              @change="syncBundledSkill"
            />
          </label>
          <label class="setting-row !p-0">
            <span
              ><strong>{{ t('model_manager.blind_review_enabled') }}</strong></span
            >
            <input
              v-model="localSettings.blindReview!.enabled"
              type="checkbox"
              class="setting-checkbox"
            />
          </label>
          <div class="grid gap-2 sm:grid-cols-3">
            <label
              v-for="reviewer in reviewerOptions"
              :key="reviewer.key"
              class="flex items-center gap-2 text-xs text-text-secondary"
            >
              <input
                v-model="localSettings.blindReview!.reviewers[reviewer.key]"
                type="checkbox"
                :aria-label="t(reviewer.label)"
                class="setting-checkbox"
              />
              {{ t(reviewer.label) }}
            </label>
          </div>
        </div>

        <div class="rounded-lg border border-dashed border-base-300 p-4 space-y-3">
          <div>
            <h4 class="text-sm font-medium text-text-primary">
              {{ t('model_manager.import_capability') }}
            </h4>
            <p class="text-xs text-text-secondary">
              {{ t('model_manager.import_capability_help') }}
            </p>
          </div>
          <label
            class="inline-flex cursor-pointer rounded-lg bg-base-100 px-3 py-2 text-sm text-text-primary"
          >
            {{ t('model_manager.choose_manifest') }}
            <input
              type="file"
              accept="application/json,.json"
              class="sr-only"
              :aria-label="t('model_manager.choose_manifest')"
              @change="importCapabilityManifest"
            />
          </label>
          <p
            v-if="capabilityImportMessage"
            :class="capabilityImportError ? 'text-red-500' : 'text-emerald-500'"
            class="text-xs"
          >
            {{ capabilityImportMessage }}
          </p>
          <div
            v-for="capability in localSettings.capabilities!.imported"
            :key="capability.id"
            class="flex items-center justify-between gap-3 rounded-lg bg-base-100 p-3"
          >
            <label class="flex min-w-0 items-center gap-2 text-sm text-text-primary">
              <input
                v-model="capability.enabled"
                type="checkbox"
                :disabled="!capability.adapter"
                :aria-label="capability.name"
                class="setting-checkbox"
              />
              <span class="truncate">{{ capability.name }}</span>
              <small class="uppercase text-text-secondary">{{ capability.kind }}</small>
            </label>
            <button
              type="button"
              class="text-xs text-red-500"
              @click="removeCapability(capability.id)"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </section>

      <div class="flex justify-end gap-3 border-t border-base-300 pt-4">
        <button
          type="button"
          class="rounded-lg px-4 py-2 text-text-secondary"
          @click="$emit('close')"
        >
          {{ t('model_manager.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white"
          @click="handleSave"
        >
          {{ t('model_manager.save') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import MemberAccount from '@/components/membership/MemberAccount.vue';
import { useSettings } from '@/composables/useSettings';
import { useMembership } from '@/composables/useMembership';
import type { AIProvider, ExternalReviewer, Settings } from '@/types';
import { normalizeBlindReviewSettings } from '@/lib/review/reviewSettings';
import {
  normalizeCapabilitySettings,
  parseCapabilityManifest,
} from '@/lib/capabilities/capabilityRegistry';
import { loadProviderModels, type ModelCatalog } from '@/src/services/modelCatalogService';

const { t } = useI18n();
const emit = defineEmits<{ close: [] }>();
const { settings, saveSettings } = useSettings();
const { isAuthenticated } = useMembership();
type ConfigPanel = 'personal-api' | 'member-services' | 'skills-mcp';
const activePanel = ref<ConfigPanel>('member-services');
const panels: Array<{ id: ConfigPanel; label: string }> = [
  { id: 'member-services', label: 'model_manager.member_services_tab' },
  { id: 'personal-api', label: 'model_manager.personal_api_tab' },
  { id: 'skills-mcp', label: 'model_manager.mcp_tab' },
];
const providerOptions: Array<{ id: AIProvider; label: string }> = [
  { id: 'google', label: 'model_manager.google_ai' },
  { id: 'openai', label: 'model_manager.openai_compatible' },
  { id: 'anthropic', label: 'model_manager.anthropic_messages' },
];

function cloneSettings(value: Settings): Settings {
  const blindReview = normalizeBlindReviewSettings(value.blindReview);
  const capabilities = normalizeCapabilitySettings(value.capabilities);
  return {
    ...value,
    blindReview: { ...blindReview, reviewers: { ...blindReview.reviewers } },
    capabilities: { ...capabilities, imported: capabilities.imported.map((item) => ({ ...item })) },
    memberManagedTextEnabled: value.memberManagedTextEnabled ?? false,
    memberManagedImageEnabled: value.memberManagedImageEnabled ?? false,
    memberManagedNanoBananaEnabled:
      value.memberManagedNanoBananaEnabled ?? value.memberManagedImageEnabled ?? false,
    memberManagedGptImageEnabled: value.memberManagedGptImageEnabled ?? false,
  };
}

const localSettings = ref(cloneSettings(settings.value));
watch(settings, (value) => (localSettings.value = cloneSettings(value)), { deep: true });
const reviewerOptions: Array<{ key: ExternalReviewer; label: string }> = [
  { key: 'pubmed', label: 'model_manager.reviewer_pubmed' },
  { key: 'citecheck', label: 'model_manager.reviewer_citecheck' },
  { key: 'doi-mcp', label: 'model_manager.reviewer_doi' },
];
const capabilityImportMessage = ref('');
const capabilityImportError = ref(false);
const modelCatalog = ref<ModelCatalog>({ text: [], image: [] });
const isLoadingModels = ref(false);
const modelLoadMessage = ref('');
const modelLoadError = ref(false);

async function loadModels() {
  isLoadingModels.value = true;
  modelLoadMessage.value = '';
  modelLoadError.value = false;
  try {
    modelCatalog.value = await loadProviderModels(
      localSettings.value.provider,
      localSettings.value
    );
    modelLoadMessage.value = t('model_manager.models_loaded', {
      count: modelCatalog.value.text.length + modelCatalog.value.image.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'model_manager.model_load_failed';
    const [key, status] = message.split(':');
    modelLoadMessage.value = t(key, status ? { status } : undefined);
    modelLoadError.value = true;
  } finally {
    isLoadingModels.value = false;
  }
}

watch(
  () => localSettings.value.provider,
  () => {
    modelCatalog.value = { text: [], image: [] };
    modelLoadMessage.value = '';
  }
);

function syncBundledSkill() {
  localSettings.value.blindReview!.enabled =
    localSettings.value.capabilities!.bundledBlindReviewSkill;
}

async function importCapabilityManifest(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 64 * 1024) throw new Error('capabilities.file_too_large');
    const capability = parseCapabilityManifest(await file.text(), file.name);
    if (localSettings.value.capabilities!.imported.some(({ id }) => id === capability.id)) {
      throw new Error('capabilities.duplicate');
    }
    localSettings.value.capabilities!.imported.push(capability);
    capabilityImportMessage.value = t('model_manager.import_success', { name: capability.name });
    capabilityImportError.value = false;
  } catch (error) {
    const key = error instanceof Error ? error.message : 'capabilities.invalid_manifest';
    capabilityImportMessage.value = t(
      key.startsWith('capabilities.') ? key : 'capabilities.invalid_manifest'
    );
    capabilityImportError.value = true;
  } finally {
    input.value = '';
  }
}

function removeCapability(id: string) {
  localSettings.value.capabilities!.imported = localSettings.value.capabilities!.imported.filter(
    (item) => item.id !== id
  );
}

function handleSave() {
  if (!isAuthenticated.value) {
    localSettings.value.memberManagedImageEnabled = false;
    localSettings.value.memberManagedTextEnabled = false;
    localSettings.value.memberManagedNanoBananaEnabled = false;
    localSettings.value.memberManagedGptImageEnabled = false;
    localSettings.value.databaseEnabled = false;
  }
  saveSettings(localSettings.value);
  emit('close');
}
</script>

<style scoped>
.field-label {
  @apply mb-1 block text-xs font-medium text-text-secondary;
}
.field-input {
  @apply w-full rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none;
}
.setting-row {
  @apply flex items-center justify-between gap-4 rounded-lg bg-base-100 p-4 text-sm text-text-primary;
}
.setting-row span {
  @apply flex min-w-0 flex-col;
}
.setting-row small {
  @apply mt-0.5 text-xs font-normal text-text-secondary;
}
.setting-checkbox {
  @apply h-4 w-4 shrink-0 accent-brand-primary;
}
</style>
