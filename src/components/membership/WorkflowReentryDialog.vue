<template>
  <div
    v-if="visible"
    ref="dialogRoot"
    class="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="workflow-reentry-title"
    @keydown="handleKeydown"
  >
    <section
      class="w-full max-w-lg space-y-4 rounded-xl border border-base-300 bg-base-200 p-5 shadow-2xl"
    >
      <div>
        <h2 id="workflow-reentry-title" class="font-semibold text-text-primary">
          {{ t('workflow_reentry.title') }}
        </h2>
        <p class="mt-2 text-sm text-text-secondary">
          {{ t(`workflow_reentry.${operation}_description`) }}
        </p>
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          ref="primaryAction"
          type="button"
          class="rounded-lg bg-brand-primary px-4 py-3 text-sm font-semibold text-white"
          @click="finish('reanalyze')"
        >
          {{ t('workflow_reentry.reanalyze') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-base-100 px-4 py-3 text-sm font-semibold text-text-primary"
          @click="finish('continue')"
        >
          {{ t('workflow_reentry.continue') }}
        </button>
      </div>
      <button
        type="button"
        class="w-full px-4 py-2 text-sm text-text-secondary"
        @click="finish('cancel')"
      >
        {{ t('common.cancel') }}
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';

export type WorkflowReentryChoice = 'reanalyze' | 'continue' | 'cancel';
type ReentryOperation = 'regeneration' | 'deep_update';

const { t } = useI18n();
const visible = ref(false);
const operation = ref<ReentryOperation>('regeneration');
const dialogRoot = ref<HTMLElement | null>(null);
const primaryAction = ref<HTMLButtonElement | null>(null);
let resolveChoice: ((choice: WorkflowReentryChoice) => void) | null = null;
let previousFocus: HTMLElement | null = null;

function open(nextOperation: ReentryOperation): Promise<WorkflowReentryChoice> {
  if (resolveChoice) resolveChoice('cancel');
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  operation.value = nextOperation;
  visible.value = true;
  void nextTick(() => primaryAction.value?.focus());
  return new Promise((resolve) => {
    resolveChoice = resolve;
  });
}

function finish(choice: WorkflowReentryChoice) {
  visible.value = false;
  resolveChoice?.(choice);
  resolveChoice = null;
  void nextTick(() => previousFocus?.focus());
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    finish('cancel');
    return;
  }
  if (event.key !== 'Tab' || !dialogRoot.value) return;
  const focusable = Array.from(
    dialogRoot.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

defineExpose({ open });
</script>
