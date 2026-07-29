<template>
  <section
    v-if="blindReviewAvailable"
    class="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-4"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="font-semibold text-cyan-100">{{ t('blind_review.title') }}</h3>
        <p class="mt-1 text-xs text-text-secondary">{{ t('blind_review.description') }}</p>
        <p class="mt-1 text-xs text-amber-200">{{ t('blind_review.external_data_notice') }}</p>
        <p v-if="usesManagedReview" class="mt-1 text-xs text-amber-200">
          {{ t('blind_review.member_cost') }}
        </p>
      </div>
      <button
        type="button"
        class="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isRunning || reviewRoute === 'unavailable'"
        @click="handleReview"
      >
        {{ isRunning ? t('blind_review.running') : t('blind_review.button') }}
      </button>
    </div>

    <p v-if="error" class="mt-3 rounded bg-red-900/40 p-2 text-sm text-red-200" role="alert">
      {{ t('blind_review.error') }}：{{ error }}
    </p>

    <article v-if="report" class="mt-4 space-y-4" aria-live="polite">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="font-semibold text-text-primary">{{ t('blind_review.report_title') }}</h4>
        <span
          class="rounded-full px-3 py-1 text-xs font-semibold"
          :class="
            report.overallStatus === 'action-required'
              ? 'bg-red-900/50 text-red-200'
              : 'bg-amber-900/50 text-amber-100'
          "
        >
          {{ t(`blind_review.status.${report.overallStatus}`) }}
        </span>
      </div>

      <div class="rounded bg-base-100 p-3 text-sm">
        <p class="font-medium text-text-primary">
          {{ t(`blind_review.recommendation.${report.modelAssessment.recommendation}`) }}
        </p>
        <p class="mt-1 text-text-secondary">{{ report.modelAssessment.summary }}</p>
      </div>

      <div>
        <h5 class="text-sm font-semibold text-text-primary">
          {{ t('blind_review.finding_title') }}
        </h5>
        <p v-if="!report.modelAssessment.findings.length" class="mt-2 text-sm text-text-secondary">
          {{ t('blind_review.no_findings') }}
        </p>
        <ul v-else class="mt-2 space-y-2">
          <li
            v-for="finding in report.modelAssessment.findings"
            :key="finding.id"
            class="rounded bg-base-100 p-3 text-sm"
          >
            <div class="flex flex-wrap gap-2 text-xs">
              <span class="rounded bg-base-300 px-2 py-0.5 text-text-secondary">
                {{ t(`blind_review.dimension.${finding.dimension}`) }}
              </span>
              <span class="rounded bg-base-300 px-2 py-0.5 text-text-secondary">
                {{ t(`blind_review.severity.${finding.severity}`) }}
              </span>
              <span class="rounded bg-base-300 px-2 py-0.5 text-text-secondary">
                {{ t(`blind_review.verification_status.${finding.verificationStatus}`) }}
              </span>
            </div>
            <p class="mt-2 font-medium text-text-primary">{{ finding.claim }}</p>
            <p class="mt-1 text-text-secondary">{{ finding.evidence }}</p>
            <p class="mt-1 text-cyan-100">{{ finding.recommendation }}</p>
          </li>
        </ul>
      </div>

      <div v-if="report.externalVerification.length">
        <h5 class="text-sm font-semibold text-text-primary">
          {{ t('blind_review.external_title') }}
        </h5>
        <ul class="mt-2 space-y-2">
          <li
            v-for="verification in report.externalVerification"
            :key="verification.reviewer"
            class="rounded bg-base-100 p-3 text-sm"
          >
            <p class="font-medium text-text-primary">
              {{ t(`blind_review.reviewer.${verification.reviewer}`) }} ·
              {{ t(`blind_review.external_status.${verification.status}`) }}
            </p>
            <p class="mt-1 text-text-secondary">
              {{ verification.summaryKey ? t(verification.summaryKey) : verification.summary }}
            </p>
            <ul
              v-if="verification.records.length"
              class="mt-2 list-disc space-y-1 pl-5 text-xs text-text-secondary"
            >
              <li
                v-for="record in verification.records"
                :key="`${record.query}-${record.identifier || record.title}`"
              >
                <a
                  v-if="record.url"
                  :href="record.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-cyan-300 hover:underline"
                  >{{ record.title || record.identifier || record.query }}</a
                >
                <span v-else>{{ record.title || record.identifier || record.query }}</span>
              </li>
            </ul>
          </li>
        </ul>
      </div>

      <p class="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
        {{ t(report.disclaimer) }}
      </p>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AbstractData, BlindReviewReport, Conference } from '@/types';
import { normalizeBlindReviewSettings } from '@/lib/review/reviewSettings';
import { localizeError } from '@/lib/i18n/errorMessages';
import { runBlindReview } from '@/services/blindReviewService';
import { useSettings } from '@/composables/useSettings';
import {
  hasEnabledCapabilityAdapter,
  normalizeCapabilitySettings,
} from '@/lib/capabilities/capabilityRegistry';
import { resolveTextRoute } from '@/lib/llm/capabilityRouting';
import { useMembership } from '@/composables/useMembership';

const props = defineProps<{
  conference: Exclude<Conference, 'IMAGE' | 'JACC'>;
  sourceText: string;
  abstract: AbstractData;
}>();

const { t, locale } = useI18n();
const { settings } = useSettings();
const { isAuthenticated, status } = useMembership();
const isRunning = ref(false);
const report = ref<BlindReviewReport | null>(null);
const error = ref('');
let reviewRevision = 0;
const capabilities = computed(() => normalizeCapabilitySettings(settings.value.capabilities));
const blindReviewAvailable = computed(
  () =>
    Boolean(settings.value.blindReview?.enabled) &&
    capabilities.value.skillsEnabled &&
    (capabilities.value.bundledBlindReviewSkill ||
      hasEnabledCapabilityAdapter(settings.value, 'skill', 'academic-abstract-blind-review'))
);
const reviewRoute = computed(() =>
  resolveTextRoute(settings.value, isAuthenticated.value && Boolean(status.value))
);
const usesManagedReview = computed(() => reviewRoute.value === 'managed');

watch(
  [
    () => props.conference,
    () => props.sourceText,
    () => props.abstract,
    () => settings.value.blindReview,
    () => settings.value.capabilities,
  ],
  () => {
    reviewRevision += 1;
    isRunning.value = false;
    report.value = null;
    error.value = '';
  },
  { deep: true }
);

const handleReview = async () => {
  const revision = ++reviewRevision;
  isRunning.value = true;
  error.value = '';
  try {
    const nextReport = await runBlindReview({
      conference: props.conference,
      sourceText: props.sourceText,
      abstract: props.abstract,
      locale: locale.value.toLowerCase().startsWith('zh') ? 'zh' : 'en',
      settings: {
        ...normalizeBlindReviewSettings(settings.value.blindReview),
        reviewers: capabilities.value.mcpEnabled
          ? normalizeBlindReviewSettings(settings.value.blindReview).reviewers
          : { pubmed: false, citecheck: false, 'doi-mcp': false },
      },
    });
    if (revision === reviewRevision) report.value = nextReport;
  } catch (caught) {
    if (revision === reviewRevision) {
      error.value = localizeError(caught, t, 'blind_review.unknown_error');
    }
  } finally {
    if (revision === reviewRevision) isRunning.value = false;
  }
};
</script>
