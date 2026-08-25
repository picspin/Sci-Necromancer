<template>
  <div
    data-testid="glass-model-selector"
    class="model-selector"
    :aria-label="t('model_selector.aria_label')"
  >
    <label class="block min-w-0" for="global-text-model">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {{ t('model_selector.label') }}
      </span>
      <span class="model-select-field">
        <svg
          data-testid="model-selector-magic-icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="model-select-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m4 20 10.6-10.6" />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m13.4 4.4.7-2.4.7 2.4 2.4.7-2.4.7-.7 2.4-.7-2.4-2.4-.7 2.4-.7Z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m18.3 12.8.5-1.7.5 1.7 1.7.5-1.7.5-.5 1.7-.5-1.7-1.7-.5 1.7-.5Z"
          />
        </svg>
        <select
          id="global-text-model"
          :value="selection"
          class="model-select-control"
          @change="selectModel(($event.target as HTMLSelectElement).value)"
        >
          <option value="byok" :disabled="!byokAvailable && selection !== 'byok'">
            {{ byokLabel }}
          </option>
          <option value="managed:glm-5.2">
            {{ t('model_selector.member_glm') }}
          </option>
          <option value="managed:gpt-5.6-luna">
            {{ t('model_selector.member_luna') }}
          </option>
        </select>
        <svg aria-hidden="true" viewBox="0 0 20 20" class="model-select-chevron" fill="none">
          <path
            d="m6 8 4 4 4-4"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="mt-1 block truncate text-xs text-text-secondary">{{ helperText }}</span>
    </label>

    <button
      v-if="!isAuthenticated"
      type="button"
      class="mt-2 w-full rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary"
      @click="emit('open-member')"
    >
      {{ t('model_selector.sign_in_cta') }}
    </button>
    <button
      v-else-if="!byokAvailable && selection === 'byok'"
      type="button"
      class="mt-2 w-full rounded-lg border border-brand-primary px-3 py-2 text-xs font-semibold text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
      @click="emit('open-model-settings')"
    >
      {{ t('model_selector.configure_byok') }}
    </button>
    <div
      v-if="byokFailed"
      class="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-text-primary"
      role="alert"
    >
      <span class="block">{{ t('model_selector.byok_failed_no_charge') }}</span>
      <button
        type="button"
        class="mt-2 w-full rounded-md bg-brand-primary px-3 py-2 font-semibold text-white hover:bg-brand-secondary"
        @click="switchToMemberAfterFailure"
      >
        {{ t('model_selector.switch_to_member') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMembership } from '@/composables/useMembership';
import { useSettings } from '@/composables/useSettings';
import { hasTextByok, selectedByokTextModel } from '@/lib/llm/capabilityRouting';
import { BYOK_TEXT_FAILURE_EVENT } from '@/lib/llm/modelEvents';
import { releaseTextModelWorkflow } from '@/lib/llm/textModelWorkflow';

const emit = defineEmits<{
  'open-member': [];
  'open-model-settings': [];
}>();
const { t } = useI18n();
const { settings, updateSettings } = useSettings();
const membership = useMembership();
const byokFailed = ref(false);
const failedWorkflowContext = ref<string | null>(null);

const isAuthenticated = membership.isAuthenticated;
const byokAvailable = computed(() => hasTextByok(settings.value));
const byokModel = computed(() => selectedByokTextModel(settings.value));
const byokLabel = computed(() =>
  byokModel.value
    ? t('model_selector.byok_model', { model: byokModel.value })
    : t('model_selector.byok_unconfigured')
);
const selection = computed(() => {
  if (settings.value.textGenerationSource === 'managed') {
    return `managed:${settings.value.memberManagedTextModel || 'glm-5.2'}`;
  }
  if (settings.value.textGenerationSource === 'byok') return 'byok';
  if (byokAvailable.value) return 'byok';
  return isAuthenticated.value ? 'managed:glm-5.2' : 'byok';
});
const helperText = computed(() => {
  if (selection.value === 'byok') return t('model_selector.byok_help');
  return t('model_selector.member_help', {
    credits: membership.status.value?.bonusBalance ?? 0,
  });
});

function selectModel(value: string) {
  if (value === 'byok') {
    updateSettings({ textGenerationSource: 'byok' });
    return;
  }
  if (!isAuthenticated.value) {
    emit('open-member');
    return;
  }
  const model = value === 'managed:gpt-5.6-luna' ? 'gpt-5.6-luna' : 'glm-5.2';
  updateSettings({
    textGenerationSource: 'managed',
    memberManagedTextEnabled: true,
    memberManagedTextModel: model,
  });
}

function switchToMemberAfterFailure() {
  selectModel(`managed:${settings.value.memberManagedTextModel || 'glm-5.2'}`);
  if (failedWorkflowContext.value) releaseTextModelWorkflow(failedWorkflowContext.value);
  failedWorkflowContext.value = null;
  byokFailed.value = false;
}

const showByokFailure = (event: Event) => {
  byokFailed.value = true;
  failedWorkflowContext.value =
    (event as CustomEvent<{ workflowContext?: string }>).detail?.workflowContext ?? null;
};
onMounted(() => window.addEventListener(BYOK_TEXT_FAILURE_EVENT, showByokFailure));
onBeforeUnmount(() => window.removeEventListener(BYOK_TEXT_FAILURE_EVENT, showByokFailure));

watch(
  [isAuthenticated, byokAvailable, () => settings.value.textGenerationSource],
  ([authenticated, hasByokConfigured, source]) => {
    if (!authenticated || hasByokConfigured || source) return;
    updateSettings({
      textGenerationSource: 'managed',
      memberManagedTextEnabled: true,
      memberManagedTextModel: 'glm-5.2',
    });
  },
  { immediate: true }
);
</script>

<style scoped>
.model-selector {
  min-width: 0;
}

.model-select-field {
  position: relative;
  display: block;
}

.model-select-control {
  min-height: 2.75rem;
  width: 100%;
  appearance: none;
  border: 1px solid rgb(148 163 184 / 28%);
  border-radius: 0.85rem;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 11%), rgb(255 255 255 / 4%)), rgb(15 23 42 / 66%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 12%),
    0 10px 26px rgb(2 6 23 / 24%);
  color: var(--color-text-primary, #e2e8f0);
  padding: 0.65rem 2.5rem 0.65rem 2.65rem;
  font-size: 0.875rem;
  backdrop-filter: blur(16px) saturate(145%);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.model-select-control:hover {
  border-color: rgb(45 212 191 / 48%);
}

.model-select-control:focus-visible {
  border-color: rgb(45 212 191 / 85%);
  box-shadow:
    0 0 0 3px rgb(45 212 191 / 18%),
    0 12px 30px rgb(2 6 23 / 30%);
  outline: none;
}

.model-select-control option {
  background: #162033;
  color: #e2e8f0;
}

.model-select-icon,
.model-select-chevron {
  position: absolute;
  top: 50%;
  z-index: 1;
  pointer-events: none;
  transform: translateY(-50%);
}

.model-select-icon {
  left: 0.9rem;
  height: 1.15rem;
  width: 1.15rem;
  color: #5eead4;
  filter: drop-shadow(0 0 7px rgb(45 212 191 / 45%));
}

.model-select-chevron {
  right: 0.85rem;
  height: 1.1rem;
  width: 1.1rem;
  color: #94a3b8;
}
</style>
