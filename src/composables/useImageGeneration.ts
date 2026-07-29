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
  JournalStyleId,
  SchematicLayoutId,
  ImageGenerationProvider,
} from '@/types';
import { IMAGE_UPLOAD_CONSTRAINTS } from '@/types';
import { imageSpecsEngine } from '@/src/services/imageSpecsEngine';
import {
  JOURNAL_STYLE_TEMPLATES,
  SCHEMATIC_LAYOUTS,
  composeScientificImagePrompt,
  composeTemplateSpecsText,
  extractResearchIntent,
  hasManagedImageTemplate,
  recommendSchematicLayout,
} from '@/src/services/imageTemplateRegistry';
import * as llm from '@/lib/llm';
import { useMembership } from '@/src/composables/useMembership';
import { requireAIDisclosureAcceptance } from '@/lib/compliance/aiDisclosure';
import { useSettings } from '@/src/composables/useSettings';
import { useI18n } from 'vue-i18n';
import { localizeError } from '@/lib/i18n/errorMessages';
import { hasImageByok } from '@/lib/llm/capabilityRouting';

// ============================================================================
// INITIAL STATE
// ============================================================================

const createInitialSpecsState = (): ImageSpecsState => ({
  rawInput: '',
  customInstructions: '',
  parsedFields: [],
  jsonOutput: '{}',
  selectedJournalStyle: 'nature',
  selectedSchematicLayout: 'modular-grid',
  layoutManuallySelected: false,
  cursorPosition: 0,
  showSuggestions: false,
  suggestions: [],
});

const createInitialState = (): ImageGenerationState => ({
  mode: 'standard',
  imageProvider: 'google-byok',
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
  const { t } = useI18n();
  const membership = useMembership();
  const { settings } = useSettings();
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
  const hasManagedBalance = computed(
    () =>
      membership.isAuthenticated.value &&
      Boolean(membership.status.value) &&
      (membership.status.value?.bonusBalance || 0) > 0
  );
  const googleByokAvailable = computed(() => hasImageByok(settings.value, 'nano-banana-pro'));
  const openAIByokAvailable = computed(() => hasImageByok(settings.value, 'gpt-image-2'));
  const googleByokModelId = computed(() =>
    googleByokAvailable.value ? settings.value.googleImageModel?.trim() || null : null
  );
  const openAIByokModelId = computed(() =>
    openAIByokAvailable.value ? settings.value.openAIImageModel?.trim() || null : null
  );
  const nanoBananaAvailable = computed(() =>
    Boolean(
      hasManagedBalance.value &&
      (settings.value.memberManagedNanoBananaEnabled ?? settings.value.memberManagedImageEnabled)
    )
  );
  const gptImageAvailable = computed(() =>
    Boolean(hasManagedBalance.value && settings.value.memberManagedGptImageEnabled)
  );
  const selectedImageRoute = computed<'byok' | 'managed' | 'unavailable'>(() => {
    if (state.value.imageProvider === 'google-byok') {
      return googleByokAvailable.value ? 'byok' : 'unavailable';
    }
    if (state.value.imageProvider === 'openai-byok') {
      return openAIByokAvailable.value ? 'byok' : 'unavailable';
    }
    return state.value.imageProvider === 'nano-banana-pro'
      ? nanoBananaAvailable.value
        ? 'managed'
        : 'unavailable'
      : gptImageAvailable.value
        ? 'managed'
        : 'unavailable';
  });
  const managedImageAvailable = computed(() => selectedImageRoute.value !== 'unavailable');
  const managedFallbackAvailable = (provider: 'nano-banana-pro' | 'gpt-image-2') => {
    const enabled =
      provider === 'nano-banana-pro'
        ? (settings.value.memberManagedNanoBananaEnabled ??
          settings.value.memberManagedImageEnabled)
        : settings.value.memberManagedGptImageEnabled;
    return Boolean(
      enabled &&
      membership.isAuthenticated.value &&
      membership.status.value &&
      (membership.status.value.bonusBalance || 0) > 0
    );
  };

  const finalPrompt = computed(() => {
    let researchIntent = state.value.specsState.customInstructions.trim();

    // Add abstract intent if in text-to-image mode
    if (state.value.mode === 'text-to-image' && state.value.abstractIntent) {
      const abstract = state.value.abstractIntent;
      researchIntent = [
        `Title: ${abstract.title}`,
        `Impact: ${abstract.abstractData.impact}`,
        `Synopsis: ${abstract.abstractData.synopsis}`,
        researchIntent,
      ]
        .filter(Boolean)
        .join('\n');
    }
    return composeScientificImagePrompt({
      journalStyleId: state.value.specsState.selectedJournalStyle,
      layoutId: state.value.specsState.selectedSchematicLayout,
      researchIntent: researchIntent || 'Create a general scientific research schematic.',
    });
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

  const setImageProvider = (provider: ImageGenerationProvider) => {
    state.value.imageProvider = provider;
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
    const customInstructions = extractResearchIntent(input);
    state.value.specsState.customInstructions = customInstructions;
    let synchronizedInput = input;

    if (!state.value.specsState.layoutManuallySelected) {
      const recommendedLayout = recommendSchematicLayout(customInstructions).layoutId;
      if (recommendedLayout !== state.value.specsState.selectedSchematicLayout) {
        state.value.specsState.selectedSchematicLayout = recommendedLayout;
        if (hasManagedImageTemplate(input)) {
          synchronizedInput = composeTemplateSpecsText({
            journalStyleId: state.value.specsState.selectedJournalStyle,
            layoutId: recommendedLayout,
            researchIntent: customInstructions,
          });
        }
      }
    }

    state.value.specsState.rawInput = synchronizedInput;
    state.value.specsState.cursorPosition =
      synchronizedInput === input ? cursorPos : synchronizedInput.length;

    refreshStructuredSpecs(synchronizedInput);

    // Get suggestions for autocomplete
    const suggestions = imageSpecsEngine.getSuggestions(
      synchronizedInput,
      state.value.specsState.cursorPosition
    );
    state.value.specsState.suggestions = suggestions.map((s) => s.text);
    state.value.specsState.showSuggestions = suggestions.length > 0;
  };

  const refreshStructuredSpecs = (input: string) => {
    const parsedFields = imageSpecsEngine.parseInput(input);
    state.value.specsState.parsedFields = parsedFields;

    const journalStyle = JOURNAL_STYLE_TEMPLATES.find(
      ({ id }) => id === state.value.specsState.selectedJournalStyle
    );
    const schematicLayout = SCHEMATIC_LAYOUTS.find(
      ({ id }) => id === state.value.specsState.selectedSchematicLayout
    );
    state.value.specsState.jsonOutput =
      journalStyle && schematicLayout
        ? imageSpecsEngine.toJSON(parsedFields, { journalStyle, schematicLayout })
        : '{}';
  };

  const syncTemplateSpecs = () => {
    const customInstructions =
      state.value.specsState.customInstructions ||
      extractResearchIntent(state.value.specsState.rawInput);
    state.value.specsState.customInstructions = customInstructions;
    const rawInput = composeTemplateSpecsText({
      journalStyleId: state.value.specsState.selectedJournalStyle,
      layoutId: state.value.specsState.selectedSchematicLayout,
      researchIntent: customInstructions,
    });
    state.value.specsState.rawInput = rawInput;
    state.value.specsState.cursorPosition = rawInput.length;
    state.value.specsState.showSuggestions = false;
    refreshStructuredSpecs(rawInput);
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

  const selectJournalStyle = (styleId: JournalStyleId) => {
    state.value.specsState.selectedJournalStyle = styleId;
    syncTemplateSpecs();
  };

  const selectSchematicLayout = (layoutId: SchematicLayoutId) => {
    state.value.specsState.selectedSchematicLayout = layoutId;
    state.value.specsState.layoutManuallySelected = true;
    syncTemplateSpecs();
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
      requireAIDisclosureAcceptance();
      // Build image state for API
      const imageState = {
        file: state.value.imageFile,
        specs: finalPrompt.value,
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

      const provider =
        state.value.imageProvider === 'google-byok'
          ? 'nano-banana-pro'
          : state.value.imageProvider === 'openai-byok'
            ? 'gpt-image-2'
            : state.value.imageProvider;
      const runManagedImage = async () => {
        if (
          state.value.uploadedImages.reduce((total, image) => total + image.base64.length, 0) >
          3_200_000
        ) {
          throw new Error('managed_image_request_too_large');
        }
        const output = await membership.managedGenerate({
          idempotencyKey:
            typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `image-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          provider,
          operation: 'image_generation',
          prompt: finalPrompt.value,
          images: state.value.uploadedImages.map((image) => ({
            data: image.base64,
            mimeType: image.file.type,
          })),
        });
        if (!output.base64) throw new Error('managed_provider_empty_output');
        state.value.generatedImage = `data:${output.mimeType || 'image/png'};base64,${output.base64}`;
      };
      if (selectedImageRoute.value === 'byok') {
        try {
          const result = await llm.generateImageForProvider(provider, imageState, creativeContext);
          state.value.generatedImage = `data:image/png;base64,${result}`;
        } catch (byokError) {
          if (
            !managedFallbackAvailable(provider) ||
            !window.confirm(t('image_generation.confirm_managed_fallback'))
          )
            throw byokError;
          await runManagedImage();
        }
      } else {
        if (selectedImageRoute.value !== 'managed') throw new Error('member_generation_locked');
        await runManagedImage();
      }
    } catch (err) {
      state.value.error = localizeError(err, t, 'errors.generation_failed');
      console.error('Image generation error:', err);
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
    managedImageAvailable,
    selectedImageRoute,
    googleByokAvailable,
    openAIByokAvailable,
    googleByokModelId,
    openAIByokModelId,
    nanoBananaAvailable,
    gptImageAvailable,

    // Constants
    imageConstraints: IMAGE_UPLOAD_CONSTRAINTS,

    // Templates
    journalStyles: JOURNAL_STYLE_TEMPLATES,
    schematicLayouts: SCHEMATIC_LAYOUTS,

    // Mode actions
    setMode,
    setImageProvider,

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
    selectJournalStyle,
    selectSchematicLayout,
    clearSpecs,

    // Generation actions
    generateImage,

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
