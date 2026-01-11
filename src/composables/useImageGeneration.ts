/**
 * Composable for Image Generation Panel state management
 */

import { ref, computed } from 'vue';
import type {
  ImageGenerationState,
  ImageGenerationMode,
  ImageSpecsState,
  SavedAbstract,
  CompletionSuggestion,
  UploadedImage,
} from '@/types';
import { IMAGE_UPLOAD_CONSTRAINTS } from '@/types';
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
  uploadedImages: [], // Multi-image support
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
      // Need at least one uploaded image OR some specs for standard mode
      return (
        state.value.uploadedImages.length > 0 || state.value.specsState.rawInput.trim().length > 0
      );
    } else {
      // Text-to-image needs either abstract intent or raw input
      return (
        state.value.abstractIntent !== null || state.value.specsState.rawInput.trim().length > 0
      );
    }
  });

  const uploadedImagesCount = computed(() => state.value.uploadedImages.length);
  const canUploadMore = computed(
    () => state.value.uploadedImages.length < IMAGE_UPLOAD_CONSTRAINTS.maxFiles
  );

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
      // Clear multi-image state when switching to text-to-image
      clearAllImages();
    }
  };

  // ============================================================================
  // IMAGE FILE ACTIONS (Multi-image support)
  // ============================================================================

  /**
   * Upload multiple images (max 8, each ≤2MB)
   * Returns an object with success count and any errors
   */
  const uploadImages = async (
    files: FileList | File[]
  ): Promise<{ success: number; errors: string[] }> => {
    state.value.error = null;
    const errors: string[] = [];
    let successCount = 0;

    const fileArray = Array.from(files);

    for (const file of fileArray) {
      // Check if we've reached the limit
      if (state.value.uploadedImages.length >= IMAGE_UPLOAD_CONSTRAINTS.maxFiles) {
        errors.push(`Maximum ${IMAGE_UPLOAD_CONSTRAINTS.maxFiles} images allowed`);
        break;
      }

      // Validate file type
      if (!IMAGE_UPLOAD_CONSTRAINTS.acceptedTypes.includes(file.type as any)) {
        errors.push(`${file.name}: Invalid file type. Accepted: JPEG, PNG, WebP, GIF`);
        continue;
      }

      // Validate file size
      if (file.size > IMAGE_UPLOAD_CONSTRAINTS.maxFileSizeBytes) {
        errors.push(
          `${file.name}: File too large (max ${IMAGE_UPLOAD_CONSTRAINTS.maxFileSizeMB}MB)`
        );
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const previewUrl = URL.createObjectURL(file);

        const uploadedImage: UploadedImage = {
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          file,
          base64,
          previewUrl,
          sizeInMB: parseFloat((file.size / (1024 * 1024)).toFixed(2)),
        };

        state.value.uploadedImages.push(uploadedImage);

        // Also set legacy single-image state for backwards compatibility (use first image)
        if (state.value.uploadedImages.length === 1) {
          state.value.imageFile = file;
          state.value.imageBase64 = base64;
        }

        successCount++;
      } catch (err) {
        errors.push(`${file.name}: Failed to read file`);
        console.error('Error reading image file:', err);
      }
    }

    if (errors.length > 0) {
      state.value.error = errors.join('\n');
    }

    return { success: successCount, errors };
  };

  /**
   * Remove a single image by ID
   */
  const removeImage = (imageId: string) => {
    const index = state.value.uploadedImages.findIndex((img) => img.id === imageId);
    if (index !== -1) {
      // Revoke object URL to free memory
      URL.revokeObjectURL(state.value.uploadedImages[index].previewUrl);
      state.value.uploadedImages.splice(index, 1);

      // Update legacy single-image state
      if (state.value.uploadedImages.length > 0) {
        state.value.imageFile = state.value.uploadedImages[0].file;
        state.value.imageBase64 = state.value.uploadedImages[0].base64;
      } else {
        state.value.imageFile = null;
        state.value.imageBase64 = null;
      }
    }
  };

  /**
   * Clear all uploaded images
   */
  const clearAllImages = () => {
    // Revoke all object URLs
    state.value.uploadedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    state.value.uploadedImages = [];
    state.value.imageFile = null;
    state.value.imageBase64 = null;
  };

  // Legacy single-image upload (kept for backwards compatibility)
  const uploadImage = async (file: File) => {
    await uploadImages([file]);
  };

  const clearImage = () => {
    clearAllImages();
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
        // Pass all uploaded images for multi-image support
        uploadedImages: state.value.uploadedImages,
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
    state.value.generatedImage = null;

    try {
      const imageState = {
        file: state.value.imageFile,
        specs: state.value.specsState.jsonOutput || state.value.specsState.rawInput,
        base64: state.value.imageBase64,
        // Pass all uploaded images for multi-image support
        uploadedImages: state.value.uploadedImages,
      };

      // Try backend proxy first, fall back to direct API
      let result: string;
      try {
        result = await llm.generateImageNanobanaViaProxy(
          imageState,
          state.value.specsState.jsonOutput
        );
      } catch (proxyError) {
        console.warn('Backend proxy failed, falling back to direct API:', proxyError);
        // Fall back to direct API call
        result = await llm.generateImageNanobana(imageState, state.value.specsState.jsonOutput);
      }

      state.value.generatedImage = `data:image/png;base64,${result}`;
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
    uploadedImagesCount,
    canUploadMore,

    // Constants
    imageConstraints: IMAGE_UPLOAD_CONSTRAINTS,

    // Templates
    templates: IMAGE_TEMPLATES,

    // Mode actions
    setMode,

    // Image actions (multi-image)
    uploadImages,
    uploadImage, // Legacy single-image
    removeImage,
    clearAllImages,
    clearImage, // Legacy alias

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
