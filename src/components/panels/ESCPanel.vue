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
                :aria-label="t('ui.input_esc')"
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
                  class="flex-1 flex items-center justify-center gap-2 bg-base-300 hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                  :aria-label="t('buttons.analyze_content')"
                >
                  <SvgIcon type="sparkles" class="h-5 w-5" />
                  {{ t('buttons.analyze_content') }}
                </button>
                <button
                  @click="handleGenerateAbstract"
                  :disabled="isLoading || !selectedAbstractType"
                  class="flex-1 flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                  :aria-label="t('buttons.generate_abstract')"
                >
                  <SvgIcon type="document" class="h-5 w-5" />
                  {{ t('buttons.generate_abstract') }}
                </button>
              </template>
              <button
                v-else
                @click="handleGenerateCreative"
                :disabled="isLoading || !inputText.trim()"
                class="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
              >
                <SvgIcon type="sparkles" class="h-5 w-5" />
                {{
                  getMemeTranslation('Generate Creatively', t) || t('buttons.generate_creatively')
                }}
              </button>
            </div>

            <!-- Save and Clear buttons -->
            <div v-if="generatedAbstract" class="flex gap-3">
              <button
                @click="openSaveModal"
                :disabled="isLoading"
                class="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                :title="t('tooltips.save_abstract')"
              >
                <SvgIcon type="download" class="h-5 w-5" />
                {{ t('buttons.save_abstract') }}
              </button>
              <button
                @click="handleNewAbstract"
                :disabled="isLoading"
                class="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                :title="t('tooltips.clear_data')"
              >
                <SvgIcon type="document" class="h-5 w-5" />
                {{ t('buttons.clear_all') }}
              </button>
            </div>

            <!-- Deep Update button - only show after abstract generation -->
            <button
              v-if="generatedAbstract?.abstract"
              @click="handleDeepUpdate"
              :disabled="isLoading"
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
        :categories="selectedCategories"
        :keywords="selectedKeywords"
        :image="generatedImage"
        :is-loading="isLoading"
        :error="error"
        :loading-message="loadingMessage"
        conference="ESC"
        :source-text="inputText"
        :abstract-type="selectedAbstractType || 'ESC Scientific Abstract'"
      />
    </div>

    <!-- Analysis Modal -->
    <Modal v-if="isModalOpen && analysisResult" @close="isModalOpen = false">
      <ESCAnalysisStep
        v-if="modalStep === 'analysis'"
        :result="analysisResult"
        @confirm="handleAnalysisConfirmation"
      />
      <TypeSuggestionStep v-else :suggestions="typeSuggestions" @select="handleTypeSelection" />
    </Modal>

    <!-- Save Modal -->
    <Modal v-if="showSaveModal" @close="showSaveModal = false">
      <div class="space-y-4">
        <h2 class="text-xl font-bold text-text-primary">
          {{
            currentAbstractId
              ? t('common.edit') + ' ' + t('tabs.abstract_generation').toLowerCase()
              : t('common.save') + ' ' + t('tabs.abstract_generation').toLowerCase()
          }}
        </h2>
        <p class="text-text-secondary">
          {{
            currentAbstractId
              ? t('abstract_manager.title') +
                ' ' +
                t('navigation.esc').toLowerCase() +
                ' ' +
                t('tabs.abstract_generation').toLowerCase()
              : t('abstract_manager.title') +
                ' ' +
                t('navigation.esc').toLowerCase() +
                ' ' +
                t('tabs.abstract_generation').toLowerCase()
          }}
        </p>
        <div>
          <label for="save-title" class="block text-sm font-medium text-text-secondary mb-2">
            {{ t('common.title') }}
          </label>
          <input
            id="save-title"
            ref="saveTitleInput"
            type="text"
            v-model="saveTitle"
            :placeholder="t('forms.creative_placeholder')"
            class="w-full p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
          />
        </div>
        <div class="flex gap-3 justify-end">
          <button
            @click="showSaveModal = false"
            class="px-4 py-2 text-text-secondary border border-base-300 rounded-md hover:bg-base-100 transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="handleSaveAbstract"
            :disabled="!saveTitle.trim() || isLoading"
            class="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-secondary transition-colors disabled:bg-base-300/50 disabled:cursor-not-allowed"
          >
            {{ currentAbstractId ? t('common.edit') : t('common.save') }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type {
  AbstractData,
  GenerationMode,
  AnalysisResult,
  AbstractTypeSuggestion,
  AbstractType,
  Category,
  SavedAbstract,
} from '@/types';
import * as llm from '@/lib/llm';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import Modal from '@/components/ui/Modal.vue';
import OutputDisplay from '@/components/OutputDisplay.vue';
import { fileProcessingService } from '@/lib/file/FileProcessingService';
import { useSettings } from '@/composables/useSettings';
import { localizeError } from '@/lib/i18n/errorMessages';
import { useAbstract } from '@/composables/useAbstract';
import { useI18n } from 'vue-i18n';
import { getMemeTranslation } from '@/lib/i18n';

// Import sub-components
import TabButton from './ISMRMPanelComponents/TabButton.vue';
import ModeSelector from './ISMRMPanelComponents/ModeSelector.vue';
import ESCAnalysisStep from './ESCPanelComponents/ESCAnalysisStep.vue';
import TypeSuggestionStep from './ISMRMPanelComponents/TypeSuggestionStep.vue';

const { t } = useI18n();
const { settings, databaseService } = useSettings();
const { abstractToLoad, clearLoadedAbstract } = useAbstract();

// Global State
const isLoading = ref<boolean>(false);
const loadingMessage = ref<string>(t('output.generating'));
const error = ref<string | null>(null);
const activeTab = ref<'abstract' | 'figure'>('abstract');
const currentAbstractId = ref<string | null>(null);
const showSaveModal = ref<boolean>(false);
const saveTitle = ref<string>('');
const saveTitleInput = ref<HTMLInputElement | null>(null);

// Abstract State
const abstractMode = ref<GenerationMode>('standard');
const inputText = ref<string>('');
const analysisResult = ref<AnalysisResult | null>(null);
const selectedCategories = ref<Category[]>([]);
const selectedKeywords = ref<string[]>([]);
const typeSuggestions = ref<AbstractTypeSuggestion[]>([]);
const selectedAbstractType = ref<AbstractType | null>(null);
const isModalOpen = ref<boolean>(false);
const modalStep = ref<'analysis' | 'type'>('analysis');
const generatedAbstract = ref<AbstractData | null>(null);

const resetWorkflow = () => {
  analysisResult.value = null;
  selectedCategories.value = [];
  selectedKeywords.value = [];
  typeSuggestions.value = [];
  selectedAbstractType.value = null;
  generatedAbstract.value = null;
};

const handleTextChange = () => {
  if (analysisResult.value) {
    resetWorkflow();
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (err) => reject(err);
  });
};

const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    error.value = null;

    target.value = '';

    isLoading.value = true;
    loadingMessage.value = t('loading_messages.processing_file', { filename: file.name });

    try {
      if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsText(file);
        });
        inputText.value = text;
        if (analysisResult.value) resetWorkflow();
      } else {
        const result = await fileProcessingService.processFile(file);

        if (result.success && result.content) {
          inputText.value = result.content;
          if (analysisResult.value) resetWorkflow();
        } else if (result.error) {
          error.value = t('errors.file_processing_failed');
        } else {
          error.value = t('errors.file_read_failed');
        }
      }
    } catch (err) {
      console.error('File processing error:', err);
      error.value = localizeError(err, t, 'errors.file_processing_failed');
    } finally {
      isLoading.value = false;
    }
  }
};

const handleAnalyze = async () => {
  if (!inputText.value.trim()) {
    error.value = t('errors.no_input');
    return;
  }
  isLoading.value = true;
  loadingMessage.value = t('loading_messages.analyzing_content');
  error.value = null;
  resetWorkflow();
  try {
    // Use ESC-specific analysis
    const result = await llm.analyzeContentForConference(inputText.value, 'ESC');
    analysisResult.value = result;
    selectedKeywords.value = result.keywords;
    modalStep.value = 'analysis';
    isModalOpen.value = true;
  } catch (e) {
    error.value = localizeError(e, t, 'errors.analysis_failed');
  } finally {
    isLoading.value = false;
  }
};

const handleAnalysisConfirmation = async (cats: Category[], keys: string[]) => {
  selectedCategories.value = cats;
  selectedKeywords.value = keys;
  isLoading.value = true;
  loadingMessage.value = t('loading_messages.suggesting_abstract_types');
  try {
    // For ESC, we typically use Scientific Abstract type
    const suggestions: AbstractTypeSuggestion[] = [
      { type: 'ESC Scientific Abstract', probability: 1.0 },
    ];
    typeSuggestions.value = suggestions;
    modalStep.value = 'type';
  } catch (e) {
    error.value = localizeError(e, t, 'errors.suggestion_failed');
    isModalOpen.value = false;
  } finally {
    isLoading.value = false;
  }
};

const handleTypeSelection = (type: AbstractType) => {
  selectedAbstractType.value = type;
  isModalOpen.value = false;
};

const handleGenerateAbstract = async () => {
  if (
    !inputText.value ||
    !selectedAbstractType.value ||
    selectedCategories.value.length === 0 ||
    selectedKeywords.value.length === 0
  ) {
    error.value = t('errors.incomplete_analysis');
    return;
  }
  isLoading.value = true;
  loadingMessage.value = t('loading_messages.generating_abstract');
  error.value = null;
  generatedAbstract.value = null;
  try {
    const result = await llm.generateAbstractForConference(
      inputText.value,
      selectedAbstractType.value,
      selectedCategories.value,
      selectedKeywords.value,
      'ESC'
    );
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
    const result = await llm.generateCreativeAbstractForConference(inputText.value, 'ESC');
    generatedAbstract.value = result;
    selectedKeywords.value = result.keywords;
  } catch (e) {
    error.value = localizeError(e, t, 'errors.creative_failed');
  } finally {
    isLoading.value = false;
  }
};

const handleGenerateNanobana = () => {
  alert(
    'Nanobana Pro 3 enhanced generation is coming soon. This will require a premium API with payment gating.'
  );
};

const handleDeepUpdate = async () => {
  if (!generatedAbstract.value || !selectedAbstractType.value) return;

  isLoading.value = true;
  loadingMessage.value = t('loading_messages.deep_diving');
  error.value = null;

  try {
    const refinementPrompt = `Please refine and improve this ESC abstract while maintaining its core message and structure. Focus on:
1. Clarity and precision of language
2. Stronger impact and significance statements for cardiovascular research
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
      selectedKeywords.value
    );

    result.categories = selectedCategories.value;
    generatedAbstract.value = result;
  } catch (e) {
    error.value = localizeError(e, t, 'errors.deep_update_failed');
  } finally {
    isLoading.value = false;
  }
};

const openSaveModal = () => {
  if (!currentAbstractId.value) {
    saveTitle.value = `ESC Abstract - ${new Date().toLocaleDateString()}`;
  }
  showSaveModal.value = true;
  nextTick(() => {
    saveTitleInput.value?.focus();
  });
};

const handleSaveAbstract = async () => {
  if (!generatedAbstract.value || !selectedAbstractType.value) {
    error.value = t('errors.no_abstract');
    return;
  }

  if (!saveTitle.value.trim()) {
    error.value = t('errors.title_required');
    return;
  }

  try {
    isLoading.value = true;
    loadingMessage.value = t('common.loading');

    const abstractToSave = {
      title: saveTitle.value.trim(),
      conference: 'ESC' as const,
      abstractType: selectedAbstractType.value,
      abstractData: generatedAbstract.value,
      originalText: inputText.value,
      categories: selectedCategories.value,
      keywords: selectedKeywords.value,
    };

    if (currentAbstractId.value) {
      await databaseService.updateAbstract(currentAbstractId.value, abstractToSave);
    } else {
      const id = await databaseService.saveAbstract(abstractToSave);
      currentAbstractId.value = id;
    }

    showSaveModal.value = false;
    saveTitle.value = '';
    error.value = null;
  } catch (err) {
    error.value = localizeError(err, t, 'errors.save_failed');
  } finally {
    isLoading.value = false;
  }
};

const loadAbstractData = (abstract: SavedAbstract) => {
  inputText.value = abstract.originalText;
  generatedAbstract.value = abstract.abstractData;
  selectedCategories.value = abstract.categories || [];
  selectedKeywords.value = abstract.keywords;
  selectedAbstractType.value = abstract.abstractType;
  currentAbstractId.value = abstract.id;
  saveTitle.value = abstract.title;

  analysisResult.value = {
    categories: abstract.categories || [],
    keywords: abstract.keywords,
  };
};

const handleNewAbstract = () => {
  inputText.value = '';
  currentAbstractId.value = null;
  saveTitle.value = '';
  resetWorkflow();
};

// Load abstract from Abstract Manager
watch(abstractToLoad, (newAbstract) => {
  if (newAbstract && newAbstract.conference === 'ESC') {
    loadAbstractData(newAbstract);
    clearLoadedAbstract();
  }
});

// Setters for mode selectors
const setActiveTab = (tab: 'abstract' | 'figure') => {
  activeTab.value = tab;
};

const setAbstractMode = (mode: GenerationMode) => {
  abstractMode.value = mode;
};
</script>
