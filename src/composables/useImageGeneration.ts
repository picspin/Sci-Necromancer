/**
 * Composable for Image Generation Panel state management
 */

import { ref, computed, watch } from 'vue';
import type {
  ImageGenerationState,
  ImageGenerationMode,
  ImageSpecsState,
  ImageSpecField,
  SavedAbstract,
  CompletionSuggestion,
} from '@/types';
import { imageSpecsEngine, IMAGE_TEMPLATES } from '@/src/services/imageSpecsEngine';
import * as llm from '@/lib/llm';

// ============================================================================
// INITIAL STATE
// ============================================================================

const createInitialSpecsState = (): ImageSpecsState => ({
  rawInput: '',
  parsedFields: [],
  jsonOutput: '{}',
  selectedTemplate: null,
  cursorPosition: 0,
  showSuggestions: false,
  suggestions: [],
});

const createInitialState = (): ImageGenerationState => ({
  mode: 'standard',
  imageFile: null,
  imageBase64: null,
  specsState: createInitialSpecsState(),
  abstractIntent: null,
  generatedImage: null,
  isLoading: false,
  loadingMessage: '',
  error: null,
  zoomLevel: 100,
});

// ============================================================================
// COMPOSABLE
// ============================================================================

// Global reactive state (singleton pattern)
const state = ref<ImageGenerationState>(createInitialState());

export function useImageGeneration() {
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================

  const canGenerate = computed(() => {
    if (state.value.isLoading) return false;

    if (state.value.mode === 'standard') {
      // Need image file OR some specs for standard mode
      return state.value.imageFile !== null || state.value.specsState.rawInput.trim().length > 0;
    } else {
      // Text-to-image needs either abstract intent or raw input
      return (
        state.value.abstractIntent !== null || state.value.specsState.rawInput.trim().length > 0
      );
    }
  });

  const finalPrompt = computed(() => {
    let prompt = '';

    // Add abstract intent if in text-to-image mode
    if (state.value.mode === 'text-to-image' && state.value.abstractIntent) {
      const abstract = state.value.abstractIntent;
      prompt += `Research Intent:\n`;
      prompt += `Title: ${abstract.title}\n`;
      prompt += `Impact: ${abstract.abstractData.impact}\n`;
      prompt += `Synopsis: ${abstract.abstractData.synopsis}\n\n`;
    }

    // Add structured specs
    if (state.value.specsState.parsedFields.length > 0) {
      prompt += `Image Specifications:\n${state.value.specsState.jsonOutput}\n\n`;
    }

    // Add raw input if no structured fields
    if (
      state.value.specsState.parsedFields.length === 0 &&
      state.value.specsState.rawInput.trim()
    ) {
      prompt += `Additional Instructions:\n${state.value.specsState.rawInput}\n`;
    }

    return prompt;
  });

  const parsedFieldsCount = computed(() => state.value.specsState.parsedFields.length);

  const hasImage = computed(() => state.value.generatedImage !== null);

  const zoomStyle = computed(() => ({
    transform: `scale(${state.value.zoomLevel / 100})`,
    transformOrigin: 'center center',
  }));

  // ============================================================================
  // MODE ACTIONS
  // ============================================================================

  const setMode = (mode: ImageGenerationMode) => {
    state.value.mode = mode;
    // Clear mode-specific state when switching
    if (mode === 'standard') {
      state.value.abstractIntent = null;
    } else {
      state.value.imageFile = null;
      state.value.imageBase64 = null;
    }
  };

  // ============================================================================
  // IMAGE FILE ACTIONS
  // ============================================================================

  const uploadImage = async (file: File) => {
    state.value.imageFile = file;
    state.value.error = null;

    try {
      const base64 = await fileToBase64(file);
      state.value.imageBase64 = base64;
    } catch (err) {
      state.value.error = 'Failed to read image file';
      console.error('Error reading image file:', err);
    }
  };

  const clearImage = () => {
    state.value.imageFile = null;
    state.value.imageBase64 = null;
  };

  // ============================================================================
  // ABSTRACT INTENT ACTIONS
  // ============================================================================

  const loadAbstract = (abstract: SavedAbstract) => {
    state.value.abstractIntent = abstract;
    state.value.mode = 'text-to-image'; // Auto-switch to text-to-image mode
  };

  const clearAbstract = () => {
    state.value.abstractIntent = null;
  };

  // ============================================================================
  // SPECS FORM ACTIONS
  // ============================================================================

  const updateSpecs = (input: string, cursorPos: number) => {
    state.value.specsState.rawInput = input;
    state.value.specsState.cursorPosition = cursorPos;

    // Parse input to extract structured fields
    const parsedFields = imageSpecsEngine.parseInput(input);
    state.value.specsState.parsedFields = parsedFields;

    // Generate JSON output
    if (parsedFields.length > 0) {
      state.value.specsState.jsonOutput = imageSpecsEngine.toJSON(parsedFields);
    } else {
      state.value.specsState.jsonOutput = '{}';
    }

    // Get suggestions for autocomplete
    const suggestions = imageSpecsEngine.getSuggestions(input, cursorPos);
    state.value.specsState.suggestions = suggestions.map((s) => s.text);
    state.value.specsState.showSuggestions = suggestions.length > 0;
  };

  const getSuggestions = (input: string, cursorPos: number): CompletionSuggestion[] => {
    return imageSpecsEngine.getSuggestions(input, cursorPos);
  };

  const applySuggestion = (suggestion: string) => {
    const input = state.value.specsState.rawInput;
    const cursorPos = state.value.specsState.cursorPosition;

    // Find the word being typed and replace it
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);

    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
    const prefix = lastSpaceIndex >= 0 ? textBeforeCursor.slice(0, lastSpaceIndex + 1) : '';

    const newInput = prefix + suggestion + ' ' + textAfterCursor.trimStart();
    const newCursorPos = (prefix + suggestion + ' ').length;

    updateSpecs(newInput, newCursorPos);
    state.value.specsState.showSuggestions = false;
  };

  const hideSuggestions = () => {
    state.value.specsState.showSuggestions = false;
  };

  const applyTemplate = (templateId: string) => {
    const fields = imageSpecsEngine.applyTemplate(templateId);
    if (fields.length === 0) return;

    state.value.specsState.parsedFields = fields;
    state.value.specsState.selectedTemplate = templateId;
    state.value.specsState.rawInput = imageSpecsEngine.fieldsToText(fields);
    state.value.specsState.jsonOutput = imageSpecsEngine.toJSON(fields);
  };

  const clearSpecs = () => {
    state.value.specsState = createInitialSpecsState();
  };

  // ============================================================================
  // GENERATION ACTIONS
  // ============================================================================

  const generateImage = async () => {
    if (!canGenerate.value) return;

    state.value.isLoading = true;
    state.value.loadingMessage = 'Generating figure...';
    state.value.error = null;
    state.value.generatedImage = null;

    try {
      // Build image state for API
      const imageState = {
        file: state.value.imageFile,
        specs: state.value.specsState.jsonOutput || state.value.specsState.rawInput,
        base64: state.value.imageBase64,
      };

      // Build creative context from abstract intent
      let creativeContext = '';
      if (state.value.abstractIntent) {
        const abstract = state.value.abstractIntent;
        creativeContext = `Impact: ${abstract.abstractData.impact}\nSynopsis: ${abstract.abstractData.synopsis}`;
      }

      const result = await llm.generateImage(imageState, creativeContext);
      state.value.generatedImage = `data:image/png;base64,${result}`;
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : 'Failed to generate image';
      console.error('Image generation error:', err);
    } finally {
      state.value.isLoading = false;
      state.value.loadingMessage = '';
    }
  };

  const generateNanobana = async () => {
    if (!canGenerate.value) return;

    state.value.isLoading = true;
    state.value.loadingMessage = 'Nanobana Pro 3 generation...';
    state.value.error = null;

    try {
      // Placeholder - call the Nanobana API when implemented
      await llm.generateImageNanobana(
        {
          file: state.value.imageFile,
          specs: state.value.specsState.jsonOutput || state.value.specsState.rawInput,
          base64: state.value.imageBase64,
        },
        state.value.specsState.jsonOutput
      );
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : 'Nanobana generation failed';
      console.error('Nanobana generation error:', err);
    } finally {
      state.value.isLoading = false;
      state.value.loadingMessage = '';
    }
  };

  // ============================================================================
  // CANVAS ACTIONS
  // ============================================================================

  const zoomIn = () => {
    state.value.zoomLevel = Math.min(200, state.value.zoomLevel + 25);
  };

  const zoomOut = () => {
    state.value.zoomLevel = Math.max(25, state.value.zoomLevel - 25);
  };

  const resetZoom = () => {
    state.value.zoomLevel = 100;
  };

  const downloadImage = () => {
    if (!state.value.generatedImage) return;

    const link = document.createElement('a');
    link.href = state.value.generatedImage;
    link.download = `figure_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ============================================================================
  // RESET
  // ============================================================================

  const resetAll = () => {
    state.value = createInitialState();
  };

  const clearError = () => {
    state.value.error = null;
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove the data:mime/type;base64, prefix
      };
      reader.onerror = (err) => reject(err);
    });
  }

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    state: computed(() => state.value),

    // Computed
    canGenerate,
    finalPrompt,
    parsedFieldsCount,
    hasImage,
    zoomStyle,

    // Templates
    templates: IMAGE_TEMPLATES,

    // Mode actions
    setMode,

    // Image actions
    uploadImage,
    clearImage,

    // Abstract actions
    loadAbstract,
    clearAbstract,

    // Specs actions
    updateSpecs,
    getSuggestions,
    applySuggestion,
    hideSuggestions,
    applyTemplate,
    clearSpecs,

    // Generation actions
    generateImage,
    generateNanobana,

    // Canvas actions
    zoomIn,
    zoomOut,
    resetZoom,
    downloadImage,

    // Reset
    resetAll,
    clearError,
  };
}
