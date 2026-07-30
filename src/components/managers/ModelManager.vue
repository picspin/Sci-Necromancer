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
          <JumpingInput
            v-model="localSettings.googleApiKey"
            :label="t('model_manager.api_key')"
            type="password"
            autocomplete="off"
            class="sm:col-span-2"
          />
          <div>
            <FloatingSelect
              v-model="localSettings.model"
              :label="t('model_manager.text_model')"
              :options="textModelOptions"
            />
            <button type="button" class="manual-model-link" @click="showCustomTextModel = true">
              {{ t('model_manager.manual_model') }}
            </button>
            <JumpingInput
              v-if="showCustomTextModel"
              v-model.trim="localSettings.model"
              :label="t('model_manager.custom_text_model')"
            />
          </div>
          <div>
            <FloatingSelect
              v-model="localSettings.googleImageModel"
              :label="t('model_manager.image_model')"
              :options="imageModelOptions"
            />
            <button type="button" class="manual-model-link" @click="showCustomImageModel = true">
              {{ t('model_manager.manual_model') }}
            </button>
            <JumpingInput
              v-if="showCustomImageModel"
              v-model.trim="localSettings.googleImageModel"
              :label="t('model_manager.custom_image_model')"
            />
          </div>
        </div>

        <div
          v-else-if="localSettings.provider === 'openai'"
          class="grid gap-3 rounded-lg bg-base-100 p-4 sm:grid-cols-2"
        >
          <JumpingInput
            v-model="localSettings.openAIApiKey"
            :label="t('model_manager.api_key')"
            type="password"
            autocomplete="off"
            class="sm:col-span-2"
          />
          <JumpingInput
            v-model="localSettings.openAIBaseUrl"
            :label="t('model_manager.base_url')"
            type="url"
            autocomplete="url"
            class="sm:col-span-2"
          />
          <div>
            <FloatingSelect
              v-model="localSettings.openAITextModel"
              :label="t('model_manager.text_model')"
              :options="textModelOptions"
            />
            <button type="button" class="manual-model-link" @click="showCustomTextModel = true">
              {{ t('model_manager.manual_model') }}
            </button>
            <JumpingInput
              v-if="showCustomTextModel"
              v-model.trim="localSettings.openAITextModel"
              :label="t('model_manager.custom_text_model')"
            />
          </div>
          <div>
            <FloatingSelect
              v-model="localSettings.openAIImageModel"
              :label="t('model_manager.image_model')"
              :options="imageModelOptions"
            />
            <button type="button" class="manual-model-link" @click="showCustomImageModel = true">
              {{ t('model_manager.manual_model') }}
            </button>
            <JumpingInput
              v-if="showCustomImageModel"
              v-model.trim="localSettings.openAIImageModel"
              :label="t('model_manager.custom_image_model')"
            />
          </div>
        </div>

        <div v-else class="grid gap-3 rounded-lg bg-base-100 p-4 sm:grid-cols-2">
          <JumpingInput
            v-model="localSettings.anthropicApiKey"
            :label="t('model_manager.api_key')"
            type="password"
            autocomplete="off"
            class="sm:col-span-2"
          />
          <JumpingInput
            v-model="localSettings.anthropicBaseUrl"
            :label="t('model_manager.base_url')"
            type="url"
            autocomplete="url"
            class="sm:col-span-2"
          />
          <div class="sm:col-span-2">
            <FloatingSelect
              v-model="localSettings.anthropicTextModel"
              :label="t('model_manager.text_model')"
              :options="textModelOptions"
            />
            <button type="button" class="manual-model-link" @click="showCustomTextModel = true">
              {{ t('model_manager.manual_model') }}
            </button>
            <JumpingInput
              v-if="showCustomTextModel"
              v-model.trim="localSettings.anthropicTextModel"
              :label="t('model_manager.custom_text_model')"
            />
          </div>
        </div>
      </section>

      <section v-else-if="activePanel === 'member-services'" class="space-y-3">
        <div class="rounded-lg border border-base-300 bg-base-100 p-4 text-sm text-text-secondary">
          <h3 class="font-semibold text-text-primary">
            {{ t('model_manager.member_benefits_title') }}
          </h3>
          <p class="mt-1 text-sm">{{ t('model_manager.member_benefits_summary') }}</p>
          <div class="mt-4 overflow-x-auto rounded-lg border border-base-300">
            <table class="w-full min-w-[34rem] border-collapse text-left text-xs">
              <thead class="bg-base-200 text-text-primary">
                <tr>
                  <th scope="col" class="px-3 py-2 font-semibold">
                    {{ t('model_manager.benefit_feature') }}
                  </th>
                  <th scope="col" class="px-3 py-2 font-semibold">
                    {{ t('model_manager.benefit_visitor') }}
                  </th>
                  <th scope="col" class="px-3 py-2 font-semibold">
                    {{ t('model_manager.benefit_member') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-base-300">
                <tr v-for="benefit in memberBenefits" :key="benefit.feature">
                  <th scope="row" class="px-3 py-2 font-medium text-text-primary">
                    {{ t(benefit.feature) }}
                  </th>
                  <td class="px-3 py-2">{{ t(benefit.visitor) }}</td>
                  <td class="px-3 py-2 text-text-primary">{{ t(benefit.member) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            v-if="!isAuthenticated"
            type="button"
            class="rainbow-member-cta mt-4"
            @click="openMemberAccount"
          >
            <span>{{ t('model_manager.become_member') }}</span>
          </button>
          <div v-else class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-primary">
            <span>{{ memberStatus?.bonusBalance ?? 0 }} {{ t('membership.credit_unit') }}</span>
            <span>
              {{ t('membership.cloud_usage') }}：{{ memberStatus?.abstractCount ?? 0 }}/{{
                memberStatus?.abstractQuota ?? 30
              }}
            </span>
            <button type="button" class="text-brand-primary" @click="openMemberAccount">
              {{ t('model_manager.view_account') }}
            </button>
          </div>
          <GitHubRepoLink class="mt-4 text-xs" />
        </div>
        <fieldset class="rounded-lg border border-base-300 bg-base-100 p-4">
          <legend class="px-2 text-sm font-semibold text-text-primary">
            {{ t('model_manager.member_models_title') }}
          </legend>
          <div class="grid gap-3 lg:grid-cols-3">
            <label
              class="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200 p-3 text-sm text-text-primary"
            >
              <span class="flex min-w-0 flex-col">
                <strong>GLM-5.2 - Text</strong>
                <small class="mt-1 text-xs font-normal leading-relaxed text-text-secondary">{{
                  t('model_manager.member_model_text_help')
                }}</small>
              </span>
              <input
                v-model="localSettings.memberManagedTextEnabled"
                type="checkbox"
                :disabled="!isAuthenticated"
                aria-label="GLM-5.2 - Text"
                class="h-4 w-4 shrink-0 accent-brand-primary"
              />
            </label>
            <label
              class="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200 p-3 text-sm text-text-primary"
            >
              <span class="flex min-w-0 flex-col">
                <strong>🍌 Nanobanana pro - Image</strong>
                <small class="mt-1 text-xs font-normal leading-relaxed text-text-secondary">{{
                  t('model_manager.member_model_generation_help')
                }}</small>
              </span>
              <input
                v-model="localSettings.memberManagedNanoBananaEnabled"
                type="checkbox"
                :disabled="!isAuthenticated"
                aria-label="Nanobanana pro - Image"
                class="h-4 w-4 shrink-0 accent-brand-primary"
              />
            </label>
            <label
              class="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200 p-3 text-sm text-text-primary"
            >
              <span class="flex min-w-0 flex-col">
                <strong>GPT-Image - Image</strong>
                <small class="mt-1 text-xs font-normal leading-relaxed text-text-secondary">{{
                  t('model_manager.member_model_editing_help')
                }}</small>
              </span>
              <input
                v-model="localSettings.memberManagedGptImageEnabled"
                type="checkbox"
                :disabled="!isAuthenticated"
                aria-label="GPT-Image - Image"
                class="h-4 w-4 shrink-0 accent-brand-primary"
              />
            </label>
          </div>
        </fieldset>
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

        <div
          v-if="isAuthenticated"
          class="rounded-lg border border-base-300 bg-base-100 p-4 space-y-3"
        >
          <div>
            <h4 class="text-sm font-medium text-text-primary">
              {{ t('model_manager.managed_research_capabilities') }}
            </h4>
            <p class="text-xs text-text-secondary">
              {{ t('model_manager.managed_research_capabilities_help') }}
            </p>
          </div>
          <p v-if="managedCapabilitiesLoading" class="text-xs text-text-secondary">
            {{ t('common.loading') }}
          </p>
          <p v-else-if="managedCapabilitiesError" class="text-xs text-red-400">
            {{ t('model_manager.managed_capabilities_unavailable') }}
          </p>
          <label
            v-for="capability in managedCapabilities"
            v-else
            :key="capability.id"
            class="setting-row !p-0"
          >
            <span>
              <strong>{{ t(capability.labelKey) }}</strong>
              <small>{{ t(capability.descriptionKey) }}</small>
            </span>
            <span class="flex-row items-center gap-2">
              <small v-if="capability.bonusCost">
                {{ capability.bonusCost }} {{ t('membership.credit_unit') }}
              </small>
              <input
                type="checkbox"
                :checked="localSettings.capabilities!.managedEnabledIds.includes(capability.id)"
                :disabled="
                  (capability.kind === 'mcp' && !localSettings.capabilities!.mcpEnabled) ||
                  (capability.kind === 'agent' &&
                    (!localSettings.capabilities!.skillsEnabled || !hasManagedResearchSource))
                "
                :aria-label="t(capability.labelKey)"
                class="setting-checkbox"
                @change="
                  toggleManagedCapability(
                    capability.id,
                    ($event.target as HTMLInputElement).checked
                  )
                "
              />
            </span>
          </label>
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
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import FloatingSelect, { type FloatingSelectOption } from '@/components/ui/FloatingSelect.vue';
import JumpingInput from '@/components/ui/JumpingInput.vue';
import GitHubRepoLink from '@/components/ui/GitHubRepoLink.vue';
import { useSettings } from '@/composables/useSettings';
import { useMembership } from '@/composables/useMembership';
import type { AIProvider, ExternalReviewer, Settings } from '@/types';
import { normalizeBlindReviewSettings } from '@/lib/review/reviewSettings';
import {
  normalizeCapabilitySettings,
  parseCapabilityManifest,
} from '@/lib/capabilities/capabilityRegistry';
import { loadProviderModels, type ModelCatalog } from '@/src/services/modelCatalogService';
import type { ManagedCapabilityDescriptor } from '@/src/services/memberApiClient';
import {
  isMGAResearchToolId,
  MGA_RESEARCH_AGENT_ID,
} from '@/lib/capabilities/managedResearchCapabilities';

const { t } = useI18n();
const emit = defineEmits<{ close: []; openMember: [] }>();
const { settings, saveSettings } = useSettings();
const { isAuthenticated, status: memberStatus, memberApi } = useMembership();
type ConfigPanel = 'personal-api' | 'member-services' | 'skills-mcp';
const activePanel = ref<ConfigPanel>('member-services');
const panels: Array<{ id: ConfigPanel; label: string }> = [
  { id: 'member-services', label: 'model_manager.member_services_tab' },
  { id: 'personal-api', label: 'model_manager.personal_api_tab' },
  { id: 'skills-mcp', label: 'model_manager.mcp_tab' },
];
const memberBenefits = [
  {
    feature: 'model_manager.benefit_managed_models',
    visitor: 'model_manager.benefit_no',
    member: 'model_manager.benefit_yes_models',
  },
  {
    feature: 'model_manager.benefit_signup',
    visitor: 'model_manager.benefit_no',
    member: 'model_manager.benefit_yes_signup',
  },
  {
    feature: 'model_manager.benefit_checkin',
    visitor: 'model_manager.benefit_no',
    member: 'model_manager.benefit_yes_checkin',
  },
  {
    feature: 'model_manager.benefit_cloud',
    visitor: 'model_manager.benefit_local_only',
    member: 'model_manager.benefit_yes_cloud',
  },
  {
    feature: 'model_manager.benefit_byok',
    visitor: 'model_manager.benefit_yes_byok',
    member: 'model_manager.benefit_yes_byok',
  },
] as const;
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
    model: value.model || 'gemini-3.6-flash',
    googleImageModel: value.googleImageModel || 'gemini-3-pro-image',
    openAITextModel: value.openAITextModel || 'gpt-5',
    openAIImageModel: value.openAIImageModel || 'gpt-image-1',
    anthropicTextModel: value.anthropicTextModel || 'claude-sonnet-4-5',
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
const showCustomTextModel = ref(false);
const showCustomImageModel = ref(false);
const managedCapabilities = ref<ManagedCapabilityDescriptor[]>([]);
const managedCapabilitiesLoading = ref(false);
const managedCapabilitiesError = ref(false);
const hasManagedResearchSource = computed(() =>
  localSettings.value.capabilities!.managedEnabledIds.some(isMGAResearchToolId)
);
const providerDefaults: Record<AIProvider, ModelCatalog> = {
  google: { text: ['gemini-3.6-flash'], image: ['gemini-3-pro-image'] },
  openai: { text: ['gpt-5', 'gpt-4o'], image: ['gpt-image-1'] },
  anthropic: { text: ['claude-sonnet-4-5'], image: [] },
};

function selectableModels(kind: keyof ModelCatalog, configured?: string): FloatingSelectOption[] {
  const values = [
    configured,
    ...providerDefaults[localSettings.value.provider][kind],
    ...modelCatalog.value[kind],
  ].filter((value): value is string => Boolean(value));
  return [...new Set(values)].map((value) => ({ value, label: value }));
}

const textModelOptions = computed(() => {
  const configured =
    localSettings.value.provider === 'google'
      ? localSettings.value.model
      : localSettings.value.provider === 'openai'
        ? localSettings.value.openAITextModel
        : localSettings.value.anthropicTextModel;
  return selectableModels('text', configured);
});
const imageModelOptions = computed(() =>
  selectableModels(
    'image',
    localSettings.value.provider === 'google'
      ? localSettings.value.googleImageModel
      : localSettings.value.openAIImageModel
  )
);

function openMemberAccount() {
  emit('close');
  emit('openMember');
}

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
    showCustomTextModel.value = false;
    showCustomImageModel.value = false;
  }
);

watch([isAuthenticated, activePanel], async ([authenticated, panel]) => {
  if (!authenticated || panel !== 'skills-mcp' || managedCapabilities.value.length) return;
  managedCapabilitiesLoading.value = true;
  managedCapabilitiesError.value = false;
  try {
    managedCapabilities.value = (await memberApi.getCapabilities()).capabilities;
  } catch {
    managedCapabilitiesError.value = true;
  } finally {
    managedCapabilitiesLoading.value = false;
  }
});

function toggleManagedCapability(id: string, enabled: boolean) {
  const selected = new Set(localSettings.value.capabilities!.managedEnabledIds);
  if (enabled) selected.add(id);
  else selected.delete(id);
  if (![...selected].some(isMGAResearchToolId)) {
    selected.delete(MGA_RESEARCH_AGENT_ID);
  }
  localSettings.value.capabilities!.managedEnabledIds = [...selected];
}

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
    localSettings.value.capabilities!.managedEnabledIds = [];
  }
  saveSettings(localSettings.value);
  emit('close');
}
</script>

<style scoped>
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
.rainbow-member-cta {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: 0.5rem;
  padding: 0.625rem 1rem;
  color: white;
  font-size: 0.875rem;
  font-weight: 700;
  background: #0f172a;
}
.rainbow-member-cta::before {
  position: absolute;
  inset: -2px;
  z-index: -2;
  content: '';
  background: linear-gradient(90deg, #4a959f, #567a87, #b4c3d7, #936358, #4a959f);
  background-size: 300% 100%;
  animation: member-rainbow 3s linear infinite;
}
.rainbow-member-cta::after {
  position: absolute;
  inset: 2px;
  z-index: -1;
  border-radius: 0.375rem;
  content: '';
  background: #0f172a;
  transition: opacity 180ms ease;
}
.rainbow-member-cta:hover::after,
.rainbow-member-cta:focus-visible::after {
  opacity: 0.82;
}
@keyframes member-rainbow {
  to {
    background-position: 300% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .rainbow-member-cta::before {
    animation: none;
  }
}
.manual-model-link {
  margin-top: 0.375rem;
  color: #94a3b8;
  font-size: 0.75rem;
}
.manual-model-link:hover {
  color: #f1f5f9;
}
</style>
