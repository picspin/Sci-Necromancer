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
          @select-style="selectJournalStyle"
          @select-layout="selectSchematicLayout"
        />

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
            @update:model-value="setImageProvider($event as ImageGenerationProvider)"
          />
          <button
            @click="generateImage"
            :disabled="!canGenerate || state.isLoading || !managedImageAvailable"
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
import { ref, computed } from 'vue';
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

const { t } = useI18n();

const fileInputRef = ref<HTMLInputElement | null>(null);

const {
  state,
  canGenerate,
  journalStyles,
  schematicLayouts,
  uploadedImagesCount,
  canUploadMore,
  managedImageAvailable,
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
  zoomIn,
  zoomOut,
  resetZoom,
  downloadImage,
  resetAll,
} = useImageGeneration();

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
    value: 'nano-banana-pro',
    label:
      '🍌 Nanobanana pro · ' +
      t('image_generation.member_provider') +
      (state.value.mode === 'standard'
        ? ` · ${t('image_generation.generation_only')}`
        : nanoBananaAvailable.value
          ? ''
          : ' 🔒'),
    disabled: !nanoBananaAvailable.value || state.value.mode === 'standard',
  },
  {
    value: 'gpt-image-2',
    label:
      'GPT-Image · ' +
      t('image_generation.member_provider') +
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
