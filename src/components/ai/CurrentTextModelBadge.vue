<template>
  <div
    class="rounded-md border border-base-300 bg-base-100 px-3 py-2 text-xs text-text-secondary"
    data-test="current-text-model"
  >
    <span>{{ label }}</span>
    <button
      v-if="needsCredits"
      type="button"
      class="ml-2 rounded border border-warning/50 px-2 py-1 text-warning hover:bg-warning/10"
      @click="openMemberPanel"
    >
      {{ t('model_selector.get_credits') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettings } from '@/composables/useSettings';
import { useMembership } from '@/composables/useMembership';
import { openMemberPanel } from '@/src/services/memberCta';
import { selectedByokTextModel } from '@/lib/llm/capabilityRouting';
import { getLockedTextModel, TEXT_MODEL_WORKFLOW_EVENT } from '@/lib/llm/textModelWorkflow';

const props = defineProps<{ workflowContext: string }>();
const { t } = useI18n();
const { settings } = useSettings();
const membership = useMembership();
const revision = ref(0);

const currentModel = computed(() => {
  revision.value;
  const locked = getLockedTextModel(props.workflowContext);
  if (locked) return { ...locked, locked: true };
  if (settings.value.textGenerationSource === 'managed') {
    return {
      source: 'managed' as const,
      model: settings.value.memberManagedTextModel || 'glm-5.2',
      locked: false,
    };
  }
  const provider = settings.value.provider || 'google';
  const model = selectedByokTextModel(settings.value);
  return {
    source: 'byok' as const,
    model: model || t('model_selector.byok_unconfigured'),
    locked: false,
  };
});

const label = computed(() => {
  const current = currentModel.value;
  return t(current.locked ? 'model_selector.workflow_locked' : 'model_selector.workflow_current', {
    source:
      current.source === 'managed'
        ? t('model_selector.member_source')
        : t('model_selector.byok_source'),
    model: current.model,
  });
});

const needsCredits = computed(
  () => currentModel.value.source === 'managed' && (membership.status.value?.bonusBalance ?? 0) < 1
);

const refresh = () => {
  revision.value += 1;
};
onMounted(() => window.addEventListener(TEXT_MODEL_WORKFLOW_EVENT, refresh));
onBeforeUnmount(() => window.removeEventListener(TEXT_MODEL_WORKFLOW_EVENT, refresh));
</script>
