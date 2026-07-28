<template>
  <section class="border-b border-amber-500/40 bg-amber-500/10 px-6 py-3" aria-live="polite">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-amber-100">
        <strong>{{ t('ai_disclosure.short_title') }}</strong>
        {{ t('ai_disclosure.short_body') }}
      </p>
      <button
        type="button"
        class="shrink-0 rounded border border-amber-400 px-3 py-1 text-amber-100 hover:bg-amber-400/10"
        @click="showModal = true"
      >
        {{ accepted ? t('ai_disclosure.review') : t('ai_disclosure.review_and_accept') }}
      </button>
    </div>
  </section>

  <Modal v-if="showModal" @close="showModal = false">
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold text-text-primary">{{ t('ai_disclosure.title') }}</h2>
        <p class="mt-1 text-xs text-text-secondary">
          {{ t('ai_disclosure.version', { version: AI_DISCLOSURE_VERSION }) }}
        </p>
      </div>
      <div class="max-h-[55vh] space-y-3 overflow-y-auto text-sm text-text-secondary">
        <p>{{ t('ai_disclosure.no_guarantee') }}</p>
        <p>{{ t('ai_disclosure.author_duty') }}</p>
        <p>{{ t('ai_disclosure.data_transfer') }}</p>
        <p class="flex flex-wrap gap-x-3">
          <a
            class="text-brand-primary underline"
            href="https://openai.com/policies/privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t('ai_disclosure.openai_policy') }}</a
          >
          <a
            class="text-brand-primary underline"
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t('ai_disclosure.google_terms') }}</a
          >
        </p>
        <p>{{ t('ai_disclosure.no_fabrication') }}</p>
        <p>{{ t('ai_disclosure.no_hipaa_guarantee') }}</p>
      </div>
      <label
        class="flex items-start gap-3 rounded-lg border border-base-300 bg-base-100 p-3 text-sm"
      >
        <input v-model="confirmed" type="checkbox" class="mt-1" />
        <span>{{ t('ai_disclosure.confirmation') }}</span>
      </label>
      <button
        type="button"
        :disabled="!confirmed"
        class="w-full rounded-lg bg-brand-primary px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        @click="accept"
      >
        {{ t('ai_disclosure.accept') }}
      </button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from './Modal.vue';
import {
  AI_DISCLOSURE_REQUIRED_EVENT,
  AI_DISCLOSURE_VERSION,
  acceptAIDisclosure,
  hasAcceptedAIDisclosure,
} from '@/lib/compliance/aiDisclosure';

const { t } = useI18n();
const accepted = ref(hasAcceptedAIDisclosure());
const confirmed = ref(accepted.value);
const showModal = ref(false);

const openRequiredDisclosure = () => {
  confirmed.value = false;
  showModal.value = true;
};

const accept = () => {
  if (!confirmed.value) return;
  acceptAIDisclosure();
  accepted.value = true;
  showModal.value = false;
};

onMounted(() => window.addEventListener(AI_DISCLOSURE_REQUIRED_EVENT, openRequiredDisclosure));
onBeforeUnmount(() =>
  window.removeEventListener(AI_DISCLOSURE_REQUIRED_EVENT, openRequiredDisclosure)
);
</script>
