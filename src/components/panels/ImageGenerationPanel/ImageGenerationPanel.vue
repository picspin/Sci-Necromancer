<template>
  <div class="p-2">
    <!-- Mode Toggle -->
    <div class="flex bg-base-100 rounded-lg p-1 mb-6">
      <button
        @click="setMode('standard')"
        :class="[
          'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all',
          state.mode === 'standard'
            ? 'bg-brand-primary text-white'
            : 'text-text-secondary hover:bg-base-200',
        ]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-5 h-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
        {{ t('image_generation.mode_standard') }}
      </button>
      <button
        @click="setMode('text-to-image')"
        :class="[
          'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all',
          state.mode === 'text-to-image'
            ? 'bg-brand-primary text-white'
            : 'text-text-secondary hover:bg-base-200',
        ]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-5 h-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
          />
        </svg>
        {{ t('image_generation.mode_text_to_image') }}
      </button>
      <button
        type="button"
        disabled
        class="flex-1 rounded-md px-4 py-2 text-text-secondary opacity-60"
        :title="t('image_generation.data_chart_unavailable')"
      >
        {{ t('image_generation.data_chart_mode') }}
      </button>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left Column - Controls -->
      <div class="space-y-4">
        <!-- Multi-Image Upload (Standard mode) -->
        <div v-if="state.mode === 'standard'" class="bg-base-100 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <label class="block text-sm font-medium text-text-secondary">
              {{ t('image_generation.upload_reference') }}
            </label>
            <span class="text-xs text-text-secondary">
              {{ uploadedImagesCount }}/{{ imageConstraints.maxFiles }} ({{
                t('image_generation.max_size', { size: imageConstraints.maxFileSizeMB })
              }})
            </span>
          </div>

          <div class="space-y-3">
            <!-- File Input -->
            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              :disabled="!canUploadMore"
              @change="handleImageUpload"
              class="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <!-- Stacked Preview -->
            <StackedImagePreview
              :images="state.uploadedImages"
              :max-images="imageConstraints.maxFiles"
              @remove="removeImage"
            />

            <!-- Clear All Images Button -->
            <button
              v-if="uploadedImagesCount > 0"
              @click="clearAllImages"
              class="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-3 h-3"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {{ t('image_generation.clear_images') }}
            </button>
          </div>
        </div>

        <!-- Abstract Selector (Text-to-Image mode) -->
        <AbstractSelector
          v-if="state.mode === 'text-to-image'"
          :selected-abstract="state.abstractIntent"
          @select="loadAbstract"
          @clear="clearAbstract"
        />

        <!-- Template Buttons -->
        <TemplateButtons
          :styles="journalStyles"
          :layouts="schematicLayouts"
          :selected-style="state.specsState.selectedJournalStyle"
          :selected-layout="state.specsState.selectedSchematicLayout"
          @select-style="handleSelectJournalStyle"
          @select-layout="selectSchematicLayout"
        />

        <section
          v-if="illustrationRoutingActive"
          class="space-y-3 rounded-lg border border-cyan-500/30 bg-base-100 p-4"
        >
          <h3 class="text-sm font-semibold text-text-primary">
            {{ t('image_generation.jev_routing.title') }}
          </h3>
          <p class="text-xs text-text-secondary">
            {{ t('image_generation.jev_routing.advisory') }}
          </p>
          <label class="block text-sm text-text-secondary">
            {{ t('image_generation.jev_routing.category') }}
            <select
              :value="selectedCategory ?? ''"
              :disabled="isRouting || state.isLoading"
              @change="handleCategoryChange"
              class="mt-1 w-full rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-text-primary"
            >
              <option value="">{{ t('image_generation.jev_routing.select_category') }}</option>
              <option v-for="category in illustrationCategories" :key="category" :value="category">
                {{ t(`image_generation.jev_routing.categories.${category}`) }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="rounded border border-brand-primary px-3 py-2 text-xs text-brand-primary disabled:opacity-50"
            :disabled="
              isRouting ||
              !researchIntent ||
              researchIntent.length > 1000 ||
              Boolean(selectedCategory)
            "
            @click="recommendCategory"
          >
            {{ t('image_generation.jev_routing.recommend_category') }}
          </button>
          <div v-if="categorySuggestion" class="text-xs text-text-secondary">
            <p v-if="categorySuggestion.selected === 'unknown' || categorySuggestion.needsReview">
              {{ t('image_generation.jev_routing.uncertain') }}
            </p>
            <p v-if="categorySuggestion.selected !== 'unknown'">
              {{ t('image_generation.jev_routing.recommended') }}:
              {{ t(`image_generation.jev_routing.categories.${categorySuggestion.selected}`) }}
              <button
                type="button"
                class="ml-2 text-brand-primary underline"
                @click="confirmCategorySuggestion"
              >
                {{ t('image_generation.jev_routing.confirm') }}
              </button>
            </p>
          </div>
          <div
            v-if="selectedCategory"
            class="space-y-2 border-t border-base-300 pt-3 text-xs text-text-secondary"
          >
            <p>
              {{ t('image_generation.jev_routing.confirmed_category') }}:
              {{ t(`image_generation.jev_routing.categories.${selectedCategory}`) }}
            </p>
            <button
              v-if="!journalConfirmed"
              type="button"
              class="rounded border border-brand-primary px-3 py-2 text-brand-primary disabled:opacity-50"
              :disabled="isRouting || !researchIntent || researchIntent.length > 1000"
              @click="recommendJournal"
            >
              {{ t('image_generation.jev_routing.recommend_journal') }}
            </button>
            <div v-if="journalSuggestion && !journalConfirmed">
              <p v-if="journalSuggestion.selected === 'unknown' || journalSuggestion.needsReview">
                {{ t('image_generation.jev_routing.uncertain') }}
              </p>
              <p v-if="journalSuggestion.selected !== 'unknown'">
                {{ t('image_generation.jev_routing.recommended') }}:
                {{ journalSuggestion.selected }}
                <button
                  type="button"
                  class="ml-2 text-brand-primary underline"
                  @click="confirmJournalSuggestion"
                >
                  {{ t('image_generation.jev_routing.confirm') }}
                </button>
              </p>
            </div>
            <button
              v-if="!journalConfirmed"
              type="button"
              class="text-brand-primary underline"
              @click="confirmCurrentJournal"
            >
              {{ t('image_generation.jev_routing.confirm_current_journal') }}
            </button>
            <p v-else>
              {{ t('image_generation.jev_routing.confirmed_journal') }}:
              {{ state.specsState.selectedJournalStyle }}
            </p>
          </div>
          <div
            v-if="selectedCategory && journalConfirmed"
            class="space-y-2 border-t border-base-300 pt-3 text-xs text-text-secondary"
          >
            <button
              type="button"
              class="rounded border border-brand-primary px-3 py-2 text-brand-primary disabled:opacity-50"
              :disabled="isRouting || state.isLoading || promptForCheck.length > 6000"
              @click="checkPromptCompleteness"
            >
              {{ t('image_generation.jev_routing.check_prompt') }}
            </button>
            <p v-if="promptForCheck.length > 6000">
              {{ t('image_generation.jev_routing.prompt_too_long') }}
            </p>
            <div v-if="promptCheck" role="status">
              <p>{{ t(`image_generation.jev_routing.prompt_${promptCheck.selected}`) }}</p>
              <p v-if="promptCheck.missing.length">
                {{ t('image_generation.jev_routing.missing_fields') }}:
                {{
                  promptCheck.missing
                    .map((field) => t(`image_generation.jev_routing.dimensions.${field}`))
                    .join('、')
                }}
              </p>
              <p v-if="promptCheck.uncertain.length">
                {{ t('image_generation.jev_routing.uncertain_fields') }}:
                {{
                  promptCheck.uncertain
                    .map((field) => t(`image_generation.jev_routing.dimensions.${field}`))
                    .join('、')
                }}
              </p>
            </div>
          </div>
          <p v-if="routingError" role="alert" class="text-xs text-amber-200">{{ routingError }}</p>
        </section>

        <!-- Image Specs Form -->
        <ImageSpecsForm
          :raw-input="state.specsState.rawInput"
          :parsed-fields="state.specsState.parsedFields"
          :json-output="state.specsState.jsonOutput"
          :show-suggestions="state.specsState.showSuggestions"
          :suggestions="currentSuggestions"
          @update:raw-input="handleSpecsUpdate"
          @select-suggestion="handleSuggestionSelect"
          @hide-suggestions="hideSuggestions"
        />

        <!-- Generation Provider + Single Action -->
        <div class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <FloatingSelect
            :model-value="state.imageProvider"
            :label="t('image_generation.image_provider')"
            :options="imageProviderOptions"
            :disabled="state.isLoading"
            @update:model-value="setImageProvider($event as ImageGenerationProvider)"
          />
          <button
            @click="handleGenerateImage"
            :disabled="
              !canGenerate ||
              state.isLoading ||
              !managedImageAvailable ||
              (illustrationRoutingActive && (!selectedCategory || !journalConfirmed))
            "
            class="mt-auto h-12 w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-5 h-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            {{ t('image_generation.generate_figure') }}
          </button>
        </div>

        <div
          v-if="state.byokFailureProvider"
          class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-text-primary"
          role="alert"
        >
          <p>{{ t('image_generation.byok_failed_no_charge') }}</p>
          <button
            v-if="canRetryWithMember"
            type="button"
            class="mt-2 rounded-md bg-brand-primary px-3 py-2 font-semibold text-white hover:bg-brand-secondary"
            @click="retryByokFailureWithMember"
          >
            {{ t('image_generation.retry_with_member') }}
          </button>
        </div>

        <div
          v-if="retryFailureEligible"
          class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-text-primary"
        >
          <p>{{ t('image_generation.jev_routing.retry_failure_evidence') }}</p>
          <button
            type="button"
            class="mt-2 rounded border border-brand-primary px-3 py-2 text-brand-primary disabled:opacity-50"
            :disabled="isRouting || state.isLoading"
            @click="askRetryAdvice"
          >
            {{ t('image_generation.jev_routing.ask_retry_advice') }}
          </button>
          <p v-if="retryAdvice" role="status" class="mt-2">
            {{ t(`image_generation.jev_routing.retry_${retryAdvice.selected}`) }}
            <span v-if="retryAdvice.needsReview">{{
              t('image_generation.jev_routing.retry_uncertain')
            }}</span>
          </p>
          <button
            v-if="retryAdvice?.selected === 'retry_once' && !retryAdvice.needsReview"
            type="button"
            class="mt-2 rounded-md bg-brand-primary px-3 py-2 font-semibold text-white disabled:opacity-50"
            :disabled="state.isLoading || isRouting || !canGenerate"
            @click="confirmOneRetry"
          >
            {{ t('image_generation.jev_routing.retry_new_task') }}
          </button>
          <p v-if="retryAdviceError" role="alert" class="mt-2 text-xs text-amber-200">
            {{ retryAdviceError }}
          </p>
        </div>
        <p
          v-else-if="retryFailureMatchesState && retryAdviceUsedFor === retryFailureSignature"
          class="text-xs text-amber-200"
        >
          {{ t('image_generation.jev_routing.retry_already_used') }}
        </p>

        <div
          v-if="!nanoBananaAvailable && !gptImageAvailable"
          class="rounded-lg border border-brand-primary/30 bg-brand-primary/10 p-3 text-sm text-text-primary"
        >
          <p>{{ t('image_generation.member_access_help') }}</p>
          <button
            type="button"
            class="mt-2 rounded-md border border-brand-primary px-3 py-2 font-semibold text-brand-primary"
            @click="openMemberPanel"
          >
            {{ t('image_generation.member_access_cta') }}
          </button>
        </div>

        <!-- Clear Button -->
        <button
          @click="handleClear"
          :disabled="state.isLoading"
          class="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
          {{ t('image_generation.clear_all') }}
        </button>
      </div>

      <!-- Right Column - Canvas -->
      <div>
        <ImageCanvas
          :image="state.generatedImage"
          :is-loading="state.isLoading"
          :loading-message="state.loadingMessage"
          :error="state.error"
          :zoom-level="state.zoomLevel"
          :provenance="state.provenance"
          @download="downloadImage"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @reset-zoom="resetZoom"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CompletionSuggestion } from '@/types';
import type { ImageGenerationProvider } from '@/types';
import { useImageGeneration } from '@/composables/useImageGeneration';
import ImageCanvas from './ImageCanvas.vue';
import ImageSpecsForm from './ImageSpecsForm.vue';
import AbstractSelector from './AbstractSelector.vue';
import TemplateButtons from './TemplateButtons.vue';
import StackedImagePreview from './StackedImagePreview.vue';
import FloatingSelect, { type FloatingSelectOption } from '@/components/ui/FloatingSelect.vue';
import { openMemberPanel } from '@/src/services/memberCta';
import { useMembership } from '@/src/composables/useMembership';
import {
  ILLUSTRATION_CATEGORY_IDS,
  type IllustrationCategoryId,
} from '@/lib/figure/illustrationCategories';
import type {
  FigureRoutingDecision,
  PromptCompletenessDecision,
} from '@/backend/_jev/figureRouting';
import type { JournalStyleId } from '@/src/services/imageTemplateRegistry';

const { t } = useI18n();
const membership = useMembership();
const illustrationCategories = ILLUSTRATION_CATEGORY_IDS;
const illustrationRoutingFlag =
  import.meta.env.VITE_TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED?.trim() === 'true';
const selectedCategory = ref<IllustrationCategoryId | null>(null);
const journalConfirmed = ref(false);
const categorySuggestion = ref<FigureRoutingDecision<string> | null>(null);
const journalSuggestion = ref<FigureRoutingDecision<string> | null>(null);
const promptCheck = ref<PromptCompletenessDecision | null>(null);
const retryAdvice = ref<FigureRoutingDecision<string> | null>(null);
const retryAdviceError = ref('');
const retryAdviceUsedFor = ref<string | null>(null);
const routingModels = ref<string[]>([]);
const isRouting = ref(false);
const routingError = ref('');

const fileInputRef = ref<HTMLInputElement | null>(null);

const {
  state,
  finalPrompt,
  canGenerate,
  journalStyles,
  schematicLayouts,
  uploadedImagesCount,
  canUploadMore,
  managedImageAvailable,
  selectedImageRoute,
  googleByokAvailable,
  openAIByokAvailable,
  nanoBananaAvailable,
  gptImageAvailable,
  googleByokModelId,
  openAIByokModelId,
  googleByokSupportsEditing,
  openAIByokSupportsEditing,
  imageConstraints,
  setMode,
  setImageProvider,
  uploadImages,
  removeImage,
  clearAllImages,
  loadAbstract,
  clearAbstract,
  updateSpecs,
  getSuggestions,
  applySuggestion,
  hideSuggestions,
  selectJournalStyle,
  selectSchematicLayout,
  generateImage,
  retryByokFailureWithMember,
  zoomIn,
  zoomOut,
  resetZoom,
  downloadImage,
  resetAll,
} = useImageGeneration();

const illustrationRoutingActive = computed(
  () =>
    illustrationRoutingFlag &&
    membership.jevEnabled.value &&
    membership.jevConsent.value?.accepted === true &&
    selectedImageRoute.value === 'managed'
);
const researchIntent = computed(() =>
  [
    state.value.abstractIntent?.title,
    state.value.abstractIntent?.abstractData.impact,
    state.value.abstractIntent?.abstractData.synopsis,
    state.value.specsState.customInstructions,
  ]
    .filter(Boolean)
    .join('\n')
    .trim()
);
const promptForCheck = computed(() =>
  selectedCategory.value
    ? `${finalPrompt.value}\nScientific illustration category: ${selectedCategory.value}.`
    : ''
);
const retryFailureSignature = computed(() => {
  const failure = state.value.lastManagedFailure;
  return failure
    ? JSON.stringify([failure.prompt, failure.requestedModel, failure.referenceImageIds])
    : null;
});
const retryFailureMatchesState = computed(() => {
  const failure = state.value.lastManagedFailure;
  return Boolean(
    illustrationRoutingActive.value &&
    selectedCategory.value &&
    journalConfirmed.value &&
    failure &&
    failure.prompt === promptForCheck.value &&
    promptForCheck.value.length <= 6000 &&
    failure.referenceImageIds.length === state.value.uploadedImages.length &&
    failure.referenceImageIds.every((id, index) => id === state.value.uploadedImages[index]?.id)
  );
});
const retryFailureEligible = computed(
  () => retryFailureMatchesState.value && retryAdviceUsedFor.value !== retryFailureSignature.value
);

watch([() => state.value.abstractIntent, () => state.value.mode], () => {
  selectedCategory.value = null;
  journalConfirmed.value = false;
  categorySuggestion.value = null;
  journalSuggestion.value = null;
  routingModels.value = [];
  routingError.value = '';
});
watch(researchIntent, () => {
  categorySuggestion.value = null;
  journalSuggestion.value = null;
  routingError.value = '';
});
watch([finalPrompt, selectedCategory], () => {
  promptCheck.value = null;
});
watch([promptForCheck, () => state.value.lastManagedFailure], () => {
  retryAdvice.value = null;
  retryAdviceError.value = '';
});

const handleCategoryChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  selectedCategory.value = illustrationCategories.includes(value as IllustrationCategoryId)
    ? (value as IllustrationCategoryId)
    : null;
  categorySuggestion.value = null;
  journalSuggestion.value = null;
  journalConfirmed.value = false;
};
const handleSelectJournalStyle = (style: JournalStyleId) => {
  selectJournalStyle(style);
  journalConfirmed.value = true;
  journalSuggestion.value = null;
};
const confirmCurrentJournal = () => {
  journalConfirmed.value = true;
};
const recommendCategory = async () => {
  if (!illustrationRoutingActive.value || !researchIntent.value || selectedCategory.value) return;
  const intent = researchIntent.value;
  isRouting.value = true;
  routingError.value = '';
  try {
    const response = await membership.memberApi.figureRoute({
      kind: 'illustration-category',
      input: { researchIntent: intent },
    });
    if (researchIntent.value !== intent || !illustrationRoutingActive.value) return;
    if (response.kind !== 'illustration-category' || !('probability' in response.decision)) return;
    categorySuggestion.value = response.decision;
    routingModels.value = [...new Set([...routingModels.value, response.decision.model])];
  } catch {
    routingError.value = t('image_generation.jev_routing.unavailable');
  } finally {
    isRouting.value = false;
  }
};
const confirmCategorySuggestion = () => {
  const candidate = categorySuggestion.value?.selected;
  if (candidate && illustrationCategories.includes(candidate as IllustrationCategoryId)) {
    selectedCategory.value = candidate as IllustrationCategoryId;
    categorySuggestion.value = null;
  }
};
const recommendJournal = async () => {
  if (
    !illustrationRoutingActive.value ||
    !selectedCategory.value ||
    journalConfirmed.value ||
    !researchIntent.value
  )
    return;
  const intent = researchIntent.value;
  const category = selectedCategory.value;
  isRouting.value = true;
  routingError.value = '';
  try {
    const response = await membership.memberApi.figureRoute({
      kind: 'illustration-journal',
      input: { researchIntent: intent, category },
    });
    if (
      researchIntent.value !== intent ||
      selectedCategory.value !== category ||
      !illustrationRoutingActive.value
    )
      return;
    if (response.kind !== 'illustration-journal' || !('probability' in response.decision)) return;
    journalSuggestion.value = response.decision;
    routingModels.value = [...new Set([...routingModels.value, response.decision.model])];
  } catch {
    routingError.value = t('image_generation.jev_routing.unavailable');
  } finally {
    isRouting.value = false;
  }
};
const confirmJournalSuggestion = () => {
  const candidate = journalSuggestion.value?.selected;
  if (candidate && journalStyles.some(({ id }) => id === candidate)) {
    selectJournalStyle(candidate as JournalStyleId);
    journalConfirmed.value = true;
    journalSuggestion.value = null;
  }
};
const checkPromptCompleteness = async () => {
  if (
    !illustrationRoutingActive.value ||
    !selectedCategory.value ||
    !journalConfirmed.value ||
    isRouting.value ||
    promptForCheck.value.length > 6000
  )
    return;
  const category = selectedCategory.value;
  const prompt = promptForCheck.value;
  isRouting.value = true;
  routingError.value = '';
  try {
    const response = await membership.memberApi.figureRoute({
      kind: 'illustration-prompt',
      input: { prompt, category },
    });
    if (
      promptForCheck.value !== prompt ||
      selectedCategory.value !== category ||
      !illustrationRoutingActive.value
    )
      return;
    if (response.kind !== 'illustration-prompt' || !('missing' in response.decision)) return;
    promptCheck.value = response.decision;
    routingModels.value = [...new Set([...routingModels.value, response.decision.model])];
  } catch {
    routingError.value = t('image_generation.jev_routing.unavailable');
  } finally {
    isRouting.value = false;
  }
};
const askRetryAdvice = async () => {
  const failure = state.value.lastManagedFailure;
  const category = selectedCategory.value;
  if (!retryFailureEligible.value || !failure || !category || isRouting.value) return;
  isRouting.value = true;
  retryAdviceError.value = '';
  try {
    const response = await membership.memberApi.figureRoute({
      kind: 'illustration-retry',
      input: {
        prompt: failure.prompt,
        category,
        requestedModel: failure.requestedModel,
        errorCode: failure.errorCode,
      },
    });
    if (
      !retryFailureEligible.value ||
      state.value.lastManagedFailure !== failure ||
      response.kind !== 'illustration-retry' ||
      !('probability' in response.decision)
    )
      return;
    retryAdvice.value = response.decision;
    routingModels.value = [...new Set([...routingModels.value, response.decision.model])];
  } catch {
    if (retryFailureEligible.value)
      retryAdviceError.value = t('image_generation.jev_routing.retry_unavailable');
  } finally {
    isRouting.value = false;
  }
};
const confirmOneRetry = () => {
  if (
    !retryFailureEligible.value ||
    retryAdvice.value?.selected !== 'retry_once' ||
    retryAdvice.value.needsReview
  )
    return;
  retryAdviceUsedFor.value = retryFailureSignature.value;
  handleGenerateImage();
};
const handleGenerateImage = () => {
  if (illustrationRoutingActive.value) {
    if (!selectedCategory.value || !journalConfirmed.value) return;
    return generateImage({
      illustrationCategory: selectedCategory.value,
      routingModels: routingModels.value,
    });
  }
  return generateImage();
};

const canRetryWithMember = computed(() =>
  state.value.byokFailureProvider === 'google-byok'
    ? nanoBananaAvailable.value
    : gptImageAvailable.value
);

// Get suggestions for the current input
const currentSuggestions = computed((): CompletionSuggestion[] => {
  return getSuggestions(state.value.specsState.rawInput, state.value.specsState.cursorPosition);
});
const imageProviderOptions = computed<FloatingSelectOption[]>(() => [
  {
    value: 'google-byok',
    label: googleByokModelId.value
      ? `Google · ${googleByokModelId.value}`
      : `Google · ${t('image_generation.image_model_pending')}`,
    disabled:
      !googleByokAvailable.value ||
      (state.value.mode === 'standard' && !googleByokSupportsEditing.value),
  },
  {
    value: 'openai-byok',
    label: openAIByokModelId.value
      ? `OpenAI · ${openAIByokModelId.value}`
      : `OpenAI · ${t('image_generation.image_model_pending')}`,
    disabled:
      !openAIByokAvailable.value ||
      (state.value.mode === 'standard' && !openAIByokSupportsEditing.value),
  },
  {
    value: 'mga-gemini-3.1-flash-image',
    label:
      '🍌 Gemini 3.1 Flash Image · ' +
      t('image_generation.member_provider') +
      ` · ${t('image_generation.member_image_cost')}` +
      (nanoBananaAvailable.value ? '' : ' 🔒'),
    disabled: !nanoBananaAvailable.value,
  },
  {
    value: 'mga-gemini-3-pro-image',
    label:
      '🍌 Gemini 3 Pro Image · ' +
      t('image_generation.member_provider') +
      ` · ${t('image_generation.member_image_cost')}` +
      (nanoBananaAvailable.value ? '' : ' 🔒'),
    disabled: !nanoBananaAvailable.value,
  },
  {
    value: 'gpt-image-2',
    label:
      'GPT-Image · ' +
      t('image_generation.member_provider') +
      ` · ${t('image_generation.member_image_cost')}` +
      (gptImageAvailable.value ? '' : ' 🔒'),
    disabled: !gptImageAvailable.value,
  },
]);

// Handle multiple image file upload
const handleImageUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    await uploadImages(target.files);
    target.value = ''; // Reset input to allow re-uploading same files
  }
};

// Handle specs text input
const handleSpecsUpdate = (value: string, cursorPos: number) => {
  updateSpecs(value, cursorPos);
};

// Handle suggestion selection
const handleSuggestionSelect = (suggestion: CompletionSuggestion) => {
  applySuggestion(suggestion.text);
};

// Handle clear all
const handleClear = () => {
  if (confirm(t('image_generation.confirm_clear'))) {
    resetAll();
  }
};
</script>
