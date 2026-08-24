<template>
  <section
    class="border-b border-base-300 bg-base-100 px-6 py-3"
    :aria-label="t('model_selector.aria_label')"
  >
    <div class="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <label class="block min-w-0 flex-1" for="global-text-model">
        <span class="mb-1 block text-sm font-semibold text-text-primary">
          {{ t('model_selector.label') }}
        </span>
        <select
          id="global-text-model"
          :value="selection"
          class="min-h-11 w-full rounded-lg border border-base-300 bg-base-200 px-3 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          @change="selectModel(($event.target as HTMLSelectElement).value)"
        >
          <option value="byok" :disabled="!byokAvailable">{{ byokLabel }}</option>
          <option value="managed:glm-5.2">
            {{ t('model_selector.member_glm') }}
          </option>
          <option value="managed:gpt-5.6-luna">
            {{ t('model_selector.member_luna') }}
          </option>
        </select>
        <span class="mt-1 block text-xs text-text-secondary">{{ helperText }}</span>
      </label>

      <button
        v-if="!isAuthenticated"
        type="button"
        class="min-h-11 shrink-0 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        @click="emit('open-member')"
      >
        {{ t('model_selector.sign_in_cta') }}
      </button>
      <button
        v-else-if="!byokAvailable && selection === 'byok'"
        type="button"
        class="min-h-11 shrink-0 rounded-lg border border-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        @click="emit('open-model-settings')"
      >
        {{ t('model_selector.configure_byok') }}
      </button>
    </div>
    <div
      v-if="byokFailed"
      class="mx-auto mt-3 flex max-w-7xl flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-text-primary sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <span>{{ t('model_selector.byok_failed_no_charge') }}</span>
      <button
        type="button"
        class="rounded-md bg-brand-primary px-3 py-2 font-semibold text-white hover:bg-brand-secondary"
        @click="switchToMemberAfterFailure"
      >
        {{ t('model_selector.switch_to_member') }}
      </button>
    </div>
  </section>
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
