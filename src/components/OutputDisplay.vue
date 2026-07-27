<template>
  <div class="bg-base-200 p-6 rounded-lg shadow-lg h-full flex flex-col">
    <!-- ARIA live region for status updates -->
    <LiveRegion :message="liveRegionMessage" :priority="error ? 'assertive' : 'polite'" />

    <div class="flex justify-between items-center mb-4 border-b border-base-300 pb-2">
      <h2 id="output-heading" class="text-lg font-bold text-text-primary">Generated Output</h2>
      <ExportButtons :abstract="abstract" :conference="conference" :abstract-type="abstractType" />
    </div>
    <div
      class="flex-grow overflow-y-auto pr-2 -mr-2"
      style="max-height: calc(100vh - 350px)"
      role="region"
      aria-labelledby="output-heading"
      aria-live="polite"
      :aria-busy="isLoading"
    >
      <LoadingSpinner v-if="isLoading" :message="loadingMessage" />
      <ErrorMessage v-if="error" :message="error" />

      <div
        v-if="!isLoading && !error && !hasOutput"
        class="text-center text-text-secondary flex flex-col items-center justify-center h-full"
      >
        <SvgIcon type="logo" class="h-16 w-16 text-base-300 mb-4" />
        <p>Your generated content will appear here.</p>
        <p class="text-sm mt-1">Begin by providing input on the left panel.</p>
      </div>

      <div class="space-y-6">
        <div
          v-if="abstract"
          class="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100"
        >
          <p class="font-semibold">{{ t('ai_disclosure.output_title') }}</p>
          <p class="mt-1">{{ t('ai_disclosure.output_body') }}</p>
        </div>

        <div v-if="abstract?.rsna" class="animate-fade-in rounded-lg bg-base-100 p-4 text-sm">
          <h3 class="font-semibold text-brand-primary">{{ t('rsna.output_route') }}</h3>
          <p class="mt-1 text-text-secondary">{{ rsnaRoute }}</p>
          <p class="mt-1 text-xs text-amber-300">
            {{ abstract.rsna.ruleVersion }} — {{ t('rsna.output_provisional') }}
          </p>
        </div>

        <div
          v-if="abstract?.complianceWarnings?.length"
          class="animate-fade-in rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm"
        >
          <h3 class="font-semibold text-red-200">{{ t('rsna.submission_checks') }}</h3>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-red-100">
            <li v-for="warning in abstract.complianceWarnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>

        <div
          v-if="abstract?.presentationGuidance?.length"
          class="animate-fade-in rounded-lg bg-base-100 p-4 text-sm"
        >
          <h3 class="font-semibold text-text-primary">{{ t('rsna.presentation_guidance') }}</h3>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-text-secondary">
            <li v-for="item in abstract.presentationGuidance" :key="item">{{ item }}</li>
          </ul>
          <p class="mt-2 text-xs text-text-secondary">
            {{ t('rsna.presentation_advisory') }}
          </p>
        </div>

        <div
          v-if="abstract?.aiAssistance"
          class="animate-fade-in rounded-lg bg-base-100 p-4 text-sm"
        >
          <h3 class="font-semibold text-text-primary">{{ t('ai_disclosure.record_title') }}</h3>
          <p class="mt-1 text-text-secondary">
            {{ abstract.aiAssistance.provider }} / {{ abstract.aiAssistance.model }} ·
            {{ abstract.aiAssistance.mode }} ·
            {{ formatTimestamp(abstract.aiAssistance.generatedAt) }}
          </p>
          <p class="mt-1 text-xs text-text-secondary">
            {{ abstract.aiAssistance.operations.join('; ') }}.
            {{ t('ai_disclosure.record_verify') }}
          </p>
        </div>
        <!-- Show Impact & Synopsis even before full abstract is generated -->
        <div v-if="displayImpact" class="animate-fade-in">
          <h3 class="flex items-center gap-2 text-md font-semibold text-blue-600 mb-2">
            <SvgIcon type="impact" class="h-5 w-5" />
            Impact
          </h3>
          <div
            class="bg-base-100 p-4 rounded-lg text-text-secondary text-sm prose max-w-none prose-p:my-2"
          >
            {{ displayImpact }}
          </div>
        </div>

        <div v-if="displaySynopsis" class="animate-fade-in">
          <h3 class="flex items-center gap-2 text-md font-semibold text-green-600 mb-2">
            <SvgIcon type="document" class="h-5 w-5" />
            Synopsis
          </h3>
          <div
            class="bg-base-100 p-4 rounded-lg text-text-secondary text-sm prose max-w-none prose-p:my-2"
          >
            {{ displaySynopsis }}
          </div>
        </div>

        <div v-if="categories && categories.length > 0" class="animate-fade-in">
          <h3 class="flex items-center gap-2 text-md font-semibold text-purple-600 mb-2">
            <SvgIcon type="tag" class="h-5 w-5" />
            Categories
          </h3>
          <div class="bg-base-100 p-4 rounded-lg">
            <div class="flex flex-wrap gap-2">
              <span
                v-for="cat in categories"
                :key="cat.name"
                :class="[
                  'px-3 py-1 text-sm rounded-full',
                  cat.type === 'main'
                    ? 'bg-purple-600/20 text-purple-600'
                    : cat.type === 'sub'
                      ? 'bg-blue-600/20 text-blue-600'
                      : 'bg-gray-600/20 text-gray-600',
                ]"
              >
                {{ cat.name }} ({{ cat.type }})
              </span>
            </div>
          </div>
        </div>

        <div v-if="keywords && keywords.length > 0" class="animate-fade-in">
          <h3 class="flex items-center gap-2 text-md font-semibold text-orange-600 mb-2">
            <SvgIcon type="tag" class="h-5 w-5" />
            Keywords
          </h3>
          <div class="bg-base-100 p-4 rounded-lg text-text-secondary text-sm">
            {{ keywords.join(', ') }}
          </div>
        </div>

        <div v-if="abstract?.abstract" class="animate-fade-in">
          <div class="flex justify-between items-center mb-2">
            <h3 class="flex items-center gap-2 text-md font-semibold text-brand-primary">
              <SvgIcon type="document" class="h-5 w-5" />
              Abstract <span v-if="abstractType">({{ abstractType }})</span>
            </h3>
            <button
              @click="copyToClipboard"
              class="flex items-center gap-2 text-sm px-3 py-1.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-md transition-all duration-200"
              title="Copy full abstract to clipboard"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="h-4 w-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                />
              </svg>
              Copy
            </button>
          </div>
          <div class="bg-base-100 p-4 rounded-lg text-text-secondary text-sm">
            <AbstractBody :content="abstract.abstract" />
          </div>
          <p class="mt-2 text-xs text-amber-300">
            {{ t('ai_disclosure.copy_reminder') }}
          </p>
        </div>

        <div v-if="image" class="animate-fade-in">
          <div class="flex justify-between items-center mb-2">
            <h3 class="flex items-center gap-2 text-md font-semibold text-brand-primary">
              <SvgIcon type="image" class="h-5 w-5" />
              Generated Figure
            </h3>
            <button
              @click="handleDownloadImage"
              class="flex items-center gap-2 text-sm px-3 py-1.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              aria-label="Download generated figure"
            >
              <SvgIcon type="download" class="h-4 w-4" />
              Download Image
            </button>
          </div>
          <div class="bg-base-100 p-2 rounded-lg">
            <img :src="image" alt="Generated Figure" class="rounded-md w-full object-contain" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AbstractData, Conference, AbstractType, Category } from '@/types';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import ExportButtons from '@/components/export/ExportButtons.vue';
import LiveRegion from '@/components/ui/LiveRegion.vue';
import AbstractBody from '@/components/ui/AbstractBody.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import ErrorMessage from '@/components/ui/ErrorMessage.vue';

interface Props {
  abstract: AbstractData | null;
  impact?: string;
  synopsis?: string;
  categories?: Category[];
  keywords?: string[];
  image?: string | null;
  isLoading: boolean;
  error: string | null;
  loadingMessage?: string;
  conference?: Conference;
  abstractType?: AbstractType;
}

const props = withDefaults(defineProps<Props>(), {
  conference: 'ISMRM',
  image: null,
});
const { t } = useI18n();

const hasOutput = computed(() => props.abstract || props.image || props.impact || props.synopsis);

const displayImpact = computed(() => props.impact || props.abstract?.impact);
const displaySynopsis = computed(() => props.synopsis || props.abstract?.synopsis);
const rsnaRoute = computed(() => {
  const route = props.abstract?.rsna;
  if (!route) return '';
  const format = route.primaryPresentationFormat.replaceAll('-', ' ');
  return `${route.track} → ${route.contentType} → ${format}`;
});

const liveRegionMessage = computed(() => {
  if (props.isLoading) return props.loadingMessage || 'Generating content...';
  if (props.error) return `Error: ${props.error}`;
  if (hasOutput.value) return 'Content generated successfully';
  return '';
});

const copyToClipboard = () => {
  if (!props.abstract) return;
  const fullText = `IMPACT:\n${props.abstract.impact}\n\nSYNOPSIS:\n${props.abstract.synopsis}\n\nABSTRACT:\n${props.abstract.abstract}\n\nKEYWORDS:\n${props.abstract.keywords.join(', ')}`;
  navigator.clipboard.writeText(fullText);
  alert('Abstract copied to clipboard!');
};

const formatTimestamp = (value: string) => new Date(value).toLocaleString();

const handleDownloadImage = () => {
  if (!props.image) return;
  const link = document.createElement('a');
  link.href = props.image;
  link.download = `figure_${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>
