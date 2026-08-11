<template>
  <div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="flex flex-col gap-6 p-4">
        <div class="flex border-b border-base-300">
          <TabButton
            id="abstract"
            :active-tab="activeTab"
            :label="t('tabs.abstract_generation')"
            icon="text"
            @set-active="setActiveTab"
          />
        </div>

        <div v-if="activeTab === 'abstract'" class="space-y-4 animate-fade-in">
          <ModeSelector :mode="abstractMode" @set-mode="setAbstractMode" />

          <div v-if="abstractMode === 'standard'" class="bg-base-100 p-4 rounded-lg">
            <label for="file-upload" class="block text-sm font-medium text-text-secondary mb-2">
              {{ t('forms.upload_file') }}
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              @change="handleFileChange"
              class="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"
              :aria-label="t('ui.upload_file')"
            />
            <div class="relative mt-2">
              <textarea
                v-model="inputText"
                @input="handleTextChange"
                :placeholder="t('forms.paste_text')"
                class="w-full h-60 p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                :aria-label="t('ui.input_ismrm')"
              />
            </div>
          </div>

          <div v-else class="bg-base-100 p-4 rounded-lg">
            <label for="creative-prompt" class="block text-sm font-medium text-text-secondary mb-2">
              {{ getMemeTranslation('Creative Expansion', t) || t('forms.creative_prompt') }}
            </label>
            <input
              id="creative-prompt"
              type="text"
              v-model="inputText"
              @input="handleTextChange"
              :placeholder="t('forms.creative_placeholder')"
              class="w-full p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
            />
          </div>

          <div class="space-y-3">
            <div class="flex flex-col sm:flex-row gap-4">
              <template v-if="abstractMode === 'standard'">
                <button
                  @click="handleAnalyze"
                  :disabled="isLoading || !inputText.trim()"
                  class="flex-1 flex items-center justify-center gap-2 bg-base-300 hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed focus:outline-none focus:ring-3 focus:ring-brand-primary"
                  :aria-label="t('buttons.analyze_content')"
                >
                  <SvgIcon type="sparkles" class="h-5 w-5" />{{ t('buttons.analyze_content') }}
                </button>
                <button
                  @click="handleGenerateAbstract"
                  :disabled="isLoading || !selectedAbstractType || Boolean(generatedAbstract)"
                  class="flex-1 flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed focus:outline-none focus:ring-3 focus:ring-brand-primary"
                  :aria-label="t('buttons.generate_abstract')"
                >
                  <SvgIcon type="document" class="h-5 w-5" />{{ t('buttons.generate_abstract') }}
                </button>
              </template>
              <button
                v-else
                @click="handleGenerateCreative"
                :disabled="isLoading || !inputText.trim() || Boolean(generatedAbstract)"
                class="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed focus:outline-none focus:ring-3 focus:ring-brand-primary"
                :aria-label="t('buttons.generate_creatively')"
              >
                <SvgIcon type="sparkles" class="h-5 w-5" />{{
                  getMemeTranslation('Generate Creatively', t) || t('buttons.generate_creatively')
                }}
              </button>
            </div>

            <!-- Save and Clear buttons -->
            <div v-if="generatedAbstract" class="flex gap-3">
              <button
                @click="handleSaveAbstract"
                :disabled="isLoading"
                class="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                :title="t('tooltips.save_abstract')"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="h-5 w-5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                  />
                </svg>
                {{ t('buttons.save_abstract') }}
              </button>
              <button
                @click="handleClear"
                :disabled="isLoading"
                class="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                :title="t('tooltips.clear_data')"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="h-5 w-5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
                {{ t('buttons.clear_all') }}
              </button>
            </div>

            <!-- Deep Update button - only show after abstract generation -->
            <button
              v-if="generatedAbstract?.abstract"
              @click="handleDeepUpdate"
              :disabled="isLoading || deepUpdateCompleted"
              class="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed animate-fade-in"
              :title="t('tooltips.deep_update')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="h-5 w-5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
              {{ t('buttons.deep_update') }}
            </button>
          </div>
        </div>
      </div>

      <OutputDisplay
        :abstract="generatedAbstract"
        :impact="impact"
        :synopsis="synopsis"
        :categories="selectedCategories"
        :keywords="selectedKeywords"
        :is-loading="isLoading"
        :error="error"
        :loading-message="loadingMessage"
        conference="ISMRM"
        :source-text="inputText"
        :creative-mode="abstractMode === 'creative'"
        :abstract-type="selectedAbstractType || undefined"
      />
    </div>

    <Modal v-if="isModalOpen && analysisResult" @close="isModalOpen = false">
      <AnalysisStep
        v-if="modalStep === 'analysis'"
        :result="analysisResult"
        :impact="impact"
        :synopsis="synopsis"
        @confirm="handleAnalysisConfirmation"
      />
      <TypeSuggestionStep v-else :suggestions="typeSuggestions" @select="handleTypeSelection" />
    </Modal>
    <WorkflowReentryDialog ref="workflowReentryDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  AbstractData,
  GenerationMode,
  AnalysisResult,
  AbstractTypeSuggestion,
  AbstractType,
  Category,
} from '@/types';
import * as llm from '@/lib/llm';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import Modal from '@/components/ui/Modal.vue';
import OutputDisplay from '@/components/OutputDisplay.vue';
import { fileProcessingService } from '@/lib/file/FileProcessingService';
import { useSettings } from '@/composables/useSettings';
import { useAbstract } from '@/composables/useAbstract';
import { getMemeTranslation } from '@/lib/i18n';
import { localizeError } from '@/lib/i18n/errorMessages';
import {
  getManagedAnalysisRetryNotice,
  prepareManagedTextReentry,
} from '@/lib/llm/managedTextWorkflow';

// Import sub-components
import TabButton from './ISMRMPanelComponents/TabButton.vue';
import ModeSelector from './ISMRMPanelComponents/ModeSelector.vue';
import AnalysisStep from './ISMRMPanelComponents/AnalysisStep.vue';
import TypeSuggestionStep from './ISMRMPanelComponents/TypeSuggestionStep.vue';
import WorkflowReentryDialog from '@/components/membership/WorkflowReentryDialog.vue';

const { t } = useI18n();
const { settings, databaseService } = useSettings();
const { abstractToLoad, clearLoadedAbstract } = useAbstract();

// Global State
const isLoading = ref<boolean>(false);
const loadingMessage = ref<string>(t('output.generating'));
const error = ref<string | null>(null);
const activeTab = ref<'abstract'>('abstract');

// Abstract State
const abstractMode = ref<GenerationMode>('standard');
const inputText = ref<string>('');
const analysisResult = ref<AnalysisResult | null>(null);
const selectedCategories = ref<Category[]>([]);
const selectedKeywords = ref<string[]>([]);
const impact = ref<string>('');
const synopsis = ref<string>('');
const typeSuggestions = ref<AbstractTypeSuggestion[]>([]);
const selectedAbstractType = ref<AbstractType | null>(null);
const isModalOpen = ref<boolean>(false);
const modalStep = ref<'analysis' | 'impactSynopsis' | 'type'>('analysis');
const generatedAbstract = ref<AbstractData | null>(null);
const workflowReentryDialog = ref<InstanceType<typeof WorkflowReentryDialog> | null>(null);
const generateAfterReanalysis = ref(false);
const deepUpdateCompleted = ref(false);

const resetWorkflow = () => {
  analysisResult.value = null;
  selectedCategories.value = [];
  selectedKeywords.value = [];
  impact.value = '';
  synopsis.value = '';
  typeSuggestions.value = [];
  selectedAbstractType.value = null;
  generatedAbstract.value = null;
  deepUpdateCompleted.value = false;
};

const handleTextChange = () => {
  if (analysisResult.value) {
    resetWorkflow();
  }
};

const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    error.value = null;

    // Clear the file input immediately to allow re-uploading the same file
    target.value = '';

    isLoading.value = true;
    loadingMessage.value = t('loading_messages.processing_file', { filename: file.name });

    try {
      // Use FileProcessingService for PDF and DOCX
      const result = await fileProcessingService.processFile(file);

      if (result.success && result.content) {
        inputText.value = result.content;
        if (analysisResult.value) resetWorkflow();
      } else if (result.error) {
        error.value = t('errors.file_processing_failed');
      }
    } catch (err) {
      error.value = localizeError(err, t, 'errors.file_processing_failed');
    } finally {
      isLoading.value = false;
    }
  }
};

const handleImageFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    try {
      const base64 = await fileToBase64(file);
      imageState.value = { ...imageState.value, file, base64 };
    } catch (err) {
      console.error('Error converting file to base64:', err);
      error.value = t('errors.image_read_failed');
    }
  }
};

const handleAnalyze = async () => {
  if (!inputText.value.trim()) {
    error.value = t('errors.no_input');
    return;
  }
  const workflowContext = `ISMRM:${inputText.value}`;
  if (
    getManagedAnalysisRetryNotice(workflowContext) === 'one_free_remaining' &&
    !window.confirm(t('membership.analysis_retry_warning'))
  )
    return;
  isLoading.value = true;
  error.value = null;
  resetWorkflow();

  try {
    // One provider call returns the full analysis bundle so the paid workflow
    // still has room for generation, one regeneration, and one deep update.
    loadingMessage.value = t('loading_messages.analyzing_content');
    const result = await llm.analyzeISMRMBundle(inputText.value);

    // Validate and sanitize the result
    const validatedResult = {
      categories: Array.isArray(result?.categories) ? result.categories : [],
      keywords: Array.isArray(result?.keywords) ? result.keywords : [],
    };

    analysisResult.value = validatedResult;
    const categories = validatedResult.categories;
    const keywords = validatedResult.keywords;
    selectedCategories.value = categories.filter((c) => c && c.probability > 0.25);
    selectedKeywords.value = keywords;

    impact.value = result.impact;
    synopsis.value = result.synopsis;
    typeSuggestions.value = Array.isArray(result.typeSuggestions) ? result.typeSuggestions : [];

    // Open modal to show results
    modalStep.value = 'analysis';
    isModalOpen.value = true;
  } catch (e) {
    generateAfterReanalysis.value = false;
    console.error('Analysis error:', e);
    error.value = localizeError(e, t, 'errors.analysis_failed');
  } finally {
    isLoading.value = false;
  }
};

const handleAnalysisConfirmation = (
  cats: Category[],
  keys: string[],
  impactText: string,
  synopsisText: string
) => {
  selectedCategories.value = cats;
  selectedKeywords.value = keys;
  impact.value = impactText;
  synopsis.value = synopsisText;
  modalStep.value = 'type';
};

const handleTypeSelection = (type: AbstractType) => {
  selectedAbstractType.value = type;
  isModalOpen.value = false;
  if (generateAfterReanalysis.value) {
    generateAfterReanalysis.value = false;
    void handleGenerateAbstract();
  }
};

const handleGenerateAbstract = async () => {
  if (
    !inputText.value ||
    !selectedAbstractType.value ||
    selectedCategories.value.length === 0 ||
    selectedKeywords.value.length === 0 ||
    !impact.value ||
    !synopsis.value
  ) {
    error.value = t('errors.incomplete_analysis');
    return;
  }
  if (
    !(await prepareManagedTextReentry(
      inputText.value,
      'regeneration',
      () => workflowReentryDialog.value?.open('regeneration') ?? Promise.resolve('cancel'),
      async () => {
        generateAfterReanalysis.value = true;
        await handleAnalyze();
      }
    ))
  )
    return;
  isLoading.value = true;
  loadingMessage.value = t('loading_messages.generating_abstract');
  error.value = null;
  generatedAbstract.value = null;
  try {
    const result = await llm.generateFinalAbstract(
      inputText.value,
      selectedAbstractType.value,
      selectedCategories.value,
      selectedKeywords.value,
      impact.value,
      synopsis.value
    );
    result.categories = selectedCategories.value;
    generatedAbstract.value = result;
  } catch (e) {
    error.value = localizeError(e, t, 'errors.generation_failed');
  } finally {
    isLoading.value = false;
  }
};

const handleGenerateCreative = async () => {
  if (!inputText.value.trim()) {
    error.value = t('errors.no_core_idea');
    return;
  }
  isLoading.value = true;
  loadingMessage.value = t('loading_messages.generating_creative');
  error.value = null;
  resetWorkflow();
  try {
    const result = await llm.generateCreativeAbstract(inputText.value);
    impact.value = result.impact;
    synopsis.value = result.synopsis;
    selectedKeywords.value = result.keywords;
    selectedAbstractType.value = 'Standard Abstract';
    generatedAbstract.value = result;
  } catch (e) {
    error.value = localizeError(e, t, 'errors.creative_failed');
  } finally {
    isLoading.value = false;
  }
};

const handleSaveAbstract = async () => {
  if (!generatedAbstract.value) return;

  try {
    const title = prompt(t('dialogs.abstract_title'));
    if (!title) return;

    await databaseService.saveAbstract({
      title,
      conference: 'ISMRM',
      abstractType: selectedAbstractType.value || 'Standard Abstract',
      abstractData: generatedAbstract.value,
      originalText: inputText.value,
      categories: selectedCategories.value,
      keywords: selectedKeywords.value,
      generationParameters: {
        provider: settings.value.provider,
        model: settings.value.model || 'gemini-2.5-pro',
        categories: selectedCategories.value,
        keywords: selectedKeywords.value,
        abstractType: selectedAbstractType.value || undefined,
      },
    });

    alert(t('dialogs.save_success'));
  } catch (e) {
    error.value = localizeError(e, t, 'errors.save_failed');
  }
};

const handleClear = () => {
  if (confirm(t('dialogs.clear_confirm'))) {
    inputText.value = '';
    resetWorkflow();
    error.value = null;
  }
};

const handleDeepUpdate = async () => {
  if (!generatedAbstract.value || !selectedAbstractType.value) return;
  if (
    !(await prepareManagedTextReentry(
      inputText.value,
      'deep_update',
      () => workflowReentryDialog.value?.open('deep_update') ?? Promise.resolve('cancel'),
      async () => {
        generateAfterReanalysis.value = true;
        await handleAnalyze();
      }
    ))
  )
    return;

  isLoading.value = true;
  loadingMessage.value = t('loading_messages.deep_diving');
  error.value = null;

  try {
    // Use the current abstract as context for refinement
    const refinementPrompt = `Please refine and improve this abstract while maintaining its core message and structure. Focus on:
1. Clarity and precision of language
2. Stronger impact and significance statements
3. Better flow and coherence
4. More specific technical details where appropriate

Current Abstract:
${generatedAbstract.value.abstract}

Impact: ${generatedAbstract.value.impact}
Synopsis: ${generatedAbstract.value.synopsis}
Keywords: ${generatedAbstract.value.keywords.join(', ')}`;

    const result = await llm.generateFinalAbstract(
      refinementPrompt,
      selectedAbstractType.value,
      selectedCategories.value,
      selectedKeywords.value,
      impact.value,
      synopsis.value,
      'deep_update',
      inputText.value
    );

    result.categories = selectedCategories.value;
    generatedAbstract.value = result;
    deepUpdateCompleted.value = true;
  } catch (e) {
    error.value = localizeError(e, t, 'errors.deep_update_failed');
  } finally {
    isLoading.value = false;
  }
};

// Load abstract from Abstract Manager
watch(abstractToLoad, (newAbstract) => {
  if (newAbstract) {
    inputText.value = newAbstract.originalText;
    generatedAbstract.value = newAbstract.abstractData;
    selectedCategories.value = newAbstract.categories || [];
    selectedKeywords.value = newAbstract.keywords;
    selectedAbstractType.value = newAbstract.abstractType;
    impact.value = newAbstract.abstractData.impact;
    synopsis.value = newAbstract.abstractData.synopsis;
    clearLoadedAbstract();
  }
});

// Setters for mode selectors
const setActiveTab = (tab: 'abstract') => {
  activeTab.value = tab;
};

const setAbstractMode = (mode: GenerationMode) => {
  if (abstractMode.value === mode) return;
  abstractMode.value = mode;
  generatedAbstract.value = null;
  error.value = null;
  resetWorkflow();
};
</script>
