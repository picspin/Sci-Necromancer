<template>
  <div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="flex flex-col gap-6 p-4">
        <div class="flex border-b border-base-300">
          <TabButton
            id="abstract"
            :active-tab="activeTab"
            label="Abstract Generation"
            icon="text"
            @set-active="setActiveTab"
          />
          <TabButton
            id="figure"
            :active-tab="activeTab"
            label="Figure Generation"
            icon="image"
            @set-active="setActiveTab"
          />
        </div>

        <div v-if="activeTab === 'abstract'" class="space-y-4 animate-fade-in">
          <ModeSelector :mode="abstractMode" @set-mode="setAbstractMode" />

          <div v-if="abstractMode === 'standard'" class="bg-base-100 p-4 rounded-lg">
            <label for="file-upload" class="block text-sm font-medium text-text-secondary mb-2">
              Upload File (.txt, .pdf, .docx) or Paste Text
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              @change="handleFileChange"
              class="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"
            />
            <div class="relative mt-2">
              <textarea
                v-model="inputText"
                @input="handleTextChange"
                placeholder="Paste your research paper or study details here for RSNA abstract generation..."
                class="w-full h-60 p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
            </div>
          </div>

          <div v-else class="bg-base-100 p-4 rounded-lg">
            <label for="creative-prompt" class="block text-sm font-medium text-text-secondary mb-2">
              Creative Expansion: Research Idea for RSNA
            </label>
            <input
              id="creative-prompt"
              type="text"
              v-model="inputText"
              @input="handleTextChange"
              placeholder="e.g., AI-powered detection of early lung cancer in chest CT scans."
              class="w-full p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <template v-if="abstractMode === 'standard'">
              <button
                @click="handleAnalyze"
                :disabled="isLoading || !inputText.trim()"
                class="flex-1 flex items-center justify-center gap-2 bg-base-300 hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
              >
                <SvgIcon type="sparkles" class="h-5 w-5" />
                1. Analyze for RSNA
              </button>
              <button
                @click="handleGenerateAbstract"
                :disabled="isLoading || !selectedAbstractType"
                class="flex-1 flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
              >
                <SvgIcon type="document" class="h-5 w-5" />
                2. Generate
              </button>
            </template>
            <button
              v-else
              @click="handleGenerateCreative"
              :disabled="isLoading || !inputText.trim()"
              class="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
            >
              <SvgIcon type="sparkles" class="h-5 w-5" />
              Generate Creatively
            </button>
          </div>

          <div
            v-if="generatedAbstract"
            class="flex flex-col sm:flex-row gap-4 pt-4 border-t border-base-300"
          >
            <button
              @click="openSaveModal"
              :disabled="isLoading"
              class="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
            >
              <SvgIcon type="download" class="h-5 w-5" />
              {{ currentAbstractId ? 'Update' : 'Save' }} Abstract
            </button>
            <button
              @click="handleNewAbstract"
              :disabled="isLoading"
              class="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
            >
              <SvgIcon type="document" class="h-5 w-5" />
              New Abstract
            </button>
          </div>
        </div>

        <div v-if="activeTab === 'figure'" class="space-y-4 animate-fade-in">
          <ImageModeSelector
            :mode="imageMode"
            :creative-disabled="!generatedAbstract"
            creative-tooltip="Generate an abstract first to enable this mode."
            @set-mode="setImageMode"
          />
          <div v-if="imageMode === 'standard'" class="bg-base-100 p-4 rounded-lg">
            <label for="image-upload" class="block text-sm font-medium text-text-secondary mb-2">
              Upload Medical Image
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              @change="handleImageFileChange"
              class="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"
            />
            <img
              v-if="imageState.base64"
              :src="`data:image/png;base64,${imageState.base64}`"
              alt="Preview"
              class="mt-4 rounded-lg max-h-40 object-contain mx-auto"
            />
          </div>
          <div v-else class="p-4 bg-base-100/50 rounded-lg text-center">
            <SvgIcon type="info" class="mx-auto h-8 w-8 text-brand-primary mb-2" />
            <p class="text-text-secondary font-medium">
              Creative mode will generate a figure based on your RSNA abstract content.
            </p>
          </div>
          <div class="bg-base-100 p-4 rounded-lg">
            <label for="image-specs" class="block text-sm font-medium text-text-secondary mb-2">
              Image Specifications & Guidelines
            </label>
            <textarea
              id="image-specs"
              v-model="imageState.specs"
              placeholder="e.g., 'Enhance contrast for better visualization', 'Add measurement annotations', 'Create comparison view'."
              class="w-full h-32 p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
            />
          </div>
          <button
            @click="handleGenerateImage"
            :disabled="isLoading"
            class="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
          >
            <SvgIcon type="image" class="h-5 w-5" />
            Generate Figure
          </button>
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
        conference="RSNA"
        :abstract-type="selectedAbstractType || 'RSNA Scientific Abstract'"
      />
    </div>

    <!-- Analysis Modal -->
    <Modal v-if="isModalOpen && analysisResult" @close="isModalOpen = false">
      <RSNAAnalysisStep
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
          {{ currentAbstractId ? 'Update Abstract' : 'Save Abstract' }}
        </h2>
        <p class="text-text-secondary">
          {{
            currentAbstractId
              ? 'Update the title for your RSNA abstract.'
              : 'Enter a title for your RSNA abstract to save it for later use.'
          }}
        </p>
        <div>
          <label for="save-title" class="block text-sm font-medium text-text-secondary mb-2">
            Abstract Title
          </label>
          <input
            id="save-title"
            ref="saveTitleInput"
            type="text"
            v-model="saveTitle"
            placeholder="Enter a descriptive title..."
            class="w-full p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
          />
        </div>
        <div class="flex gap-3 justify-end">
          <button
            @click="showSaveModal = false"
            class="px-4 py-2 text-text-secondary border border-base-300 rounded-md hover:bg-base-100 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleSaveAbstract"
            :disabled="!saveTitle.trim() || isLoading"
            class="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-secondary transition-colors disabled:bg-base-300/50 disabled:cursor-not-allowed"
          >
            {{ currentAbstractId ? 'Update' : 'Save' }}
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
  ImageState,
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
import { useAbstract } from '@/composables/useAbstract';

// Import sub-components
import TabButton from './ISMRMPanelComponents/TabButton.vue';
import ModeSelector from './ISMRMPanelComponents/ModeSelector.vue';
import ImageModeSelector from './ISMRMPanelComponents/ImageModeSelector.vue';
import RSNAAnalysisStep from './RSNAPanelComponents/RSNAAnalysisStep.vue';
import TypeSuggestionStep from './ISMRMPanelComponents/TypeSuggestionStep.vue';

const { settings, databaseService } = useSettings();
const { abstractToLoad, clearLoadedAbstract } = useAbstract();

// Global State
const isLoading = ref<boolean>(false);
const loadingMessage = ref<string>('Generating...');
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

// Image State
const imageMode = ref<GenerationMode>('standard');
const imageState = ref<ImageState>({ file: null, specs: '', base64: null });
const generatedImage = ref<string | null>(null);

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
    loadingMessage.value = `Processing ${file.name}...`;

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
          error.value = fileProcessingService.getErrorMessage(result.error);
        } else {
          error.value = 'Failed to extract text from the file.';
        }
      }
    } catch (err) {
      console.error('File processing error:', err);
      error.value = err instanceof Error ? err.message : 'Failed to process file.';
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
      error.value = 'Failed to read image file.';
    }
  }
};

const handleAnalyze = async () => {
  if (!inputText.value.trim()) {
    error.value = 'Please provide input text to analyze.';
    return;
  }
  isLoading.value = true;
  loadingMessage.value = 'Analyzing content for RSNA submission...';
  error.value = null;
  resetWorkflow();
  try {
    // Use RSNA-specific analysis
    const result = await llm.analyzeContentForConference(inputText.value, 'RSNA');
    analysisResult.value = result;
    selectedKeywords.value = result.keywords;
    modalStep.value = 'analysis';
    isModalOpen.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'An unknown error occurred during analysis.';
  } finally {
    isLoading.value = false;
  }
};

const handleAnalysisConfirmation = async (cats: Category[], keys: string[]) => {
  selectedCategories.value = cats;
  selectedKeywords.value = keys;
  isLoading.value = true;
  loadingMessage.value = 'Suggesting RSNA abstract types...';
  try {
    // For RSNA, we typically use Scientific Abstract type
    const suggestions: AbstractTypeSuggestion[] = [
      { type: 'RSNA Scientific Abstract', probability: 1.0 },
    ];
    typeSuggestions.value = suggestions;
    modalStep.value = 'type';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to get abstract type suggestions.';
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
    error.value = 'Please complete the analysis and selection steps before generating.';
    return;
  }
  isLoading.value = true;
  loadingMessage.value = 'Generating RSNA scientific abstract...';
  error.value = null;
  generatedAbstract.value = null;
  try {
    const result = await llm.generateAbstractForConference(
      inputText.value,
      selectedAbstractType.value,
      selectedCategories.value,
      selectedKeywords.value,
      'RSNA'
    );
    generatedAbstract.value = result;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'An unknown error during abstract generation.';
  } finally {
    isLoading.value = false;
  }
};

const handleGenerateCreative = async () => {
  if (!inputText.value.trim()) {
    error.value = 'Please provide a core idea to expand.';
    return;
  }
  isLoading.value = true;
  loadingMessage.value = 'Creatively generating RSNA abstract...';
  error.value = null;
  resetWorkflow();
  try {
    const result = await llm.generateCreativeAbstractForConference(inputText.value, 'RSNA');
    generatedAbstract.value = result;
    selectedKeywords.value = result.keywords;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'An unknown error during creative generation.';
  } finally {
    isLoading.value = false;
  }
};

const handleGenerateImage = async () => {
  let context = '';
  if (imageMode.value === 'creative') {
    if (!generatedAbstract.value) {
      error.value =
        'Please generate an abstract first to provide context for creative image generation.';
      return;
    }
    context = `Impact: ${generatedAbstract.value.impact}\nSynopsis: ${generatedAbstract.value.synopsis}`;
  } else if (!imageState.value.file) {
    error.value = 'Please upload an image for standard mode editing.';
    return;
  }

  isLoading.value = true;
  loadingMessage.value = 'Generating figure...';
  error.value = null;
  generatedImage.value = null;
  try {
    const result = await llm.generateImage(imageState.value, context);
    generatedImage.value = `data:image/png;base64,${result}`;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'An unknown error during image generation.';
  } finally {
    isLoading.value = false;
  }
};

const openSaveModal = () => {
  if (!currentAbstractId.value) {
    saveTitle.value = `RSNA Abstract - ${new Date().toLocaleDateString()}`;
  }
  showSaveModal.value = true;
  nextTick(() => {
    saveTitleInput.value?.focus();
  });
};

const handleSaveAbstract = async () => {
  if (!generatedAbstract.value || !selectedAbstractType.value) {
    error.value = 'Please generate an abstract before saving.';
    return;
  }

  if (!saveTitle.value.trim()) {
    error.value = 'Please enter a title for your abstract.';
    return;
  }

  try {
    isLoading.value = true;
    loadingMessage.value = 'Saving abstract...';

    const abstractToSave = {
      title: saveTitle.value.trim(),
      conference: 'RSNA' as const,
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
    error.value = err instanceof Error ? err.message : 'Failed to save abstract';
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
  if (newAbstract && newAbstract.conference === 'RSNA') {
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

const setImageMode = (mode: GenerationMode) => {
  imageMode.value = mode;
};
</script>
