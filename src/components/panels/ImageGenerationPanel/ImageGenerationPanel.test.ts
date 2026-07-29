import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../public/locales/en/translation.json';
import ImageGenerationPanel from './ImageGenerationPanel.vue';

const { generateImage, setImageProvider, panelState, providerState } = vi.hoisted(() => ({
  generateImage: vi.fn(),
  setImageProvider: vi.fn(),
  providerState: {
    googleAvailable: true,
    openAIAvailable: true,
    googleModelId: 'gemini-3-pro-image' as string | null,
    openAIModelId: 'seedream-1.5' as string | null,
  },
  panelState: {
    mode: 'standard',
    uploadedImages: [],
    abstractIntent: null,
    generatedImage: null,
    isLoading: false,
    loadingMessage: '',
    error: null,
    zoomLevel: 100,
    imageProvider: 'google-byok',
    specsState: {
      rawInput: 'Create a scientific figure',
      customInstructions: 'Create a scientific figure',
      parsedFields: [],
      jsonOutput: '{}',
      selectedJournalStyle: 'nature',
      selectedSchematicLayout: 'modular-grid',
      layoutManuallySelected: false,
      cursorPosition: 0,
      showSuggestions: false,
      suggestions: [],
    },
  },
}));

vi.mock('@/composables/useImageGeneration', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useImageGeneration: () => ({
      state: computed(() => panelState),
      canGenerate: computed(() => true),
      journalStyles: [],
      schematicLayouts: [],
      uploadedImagesCount: computed(() => 0),
      canUploadMore: computed(() => true),
      imageConstraints: { maxFiles: 8, maxFileSizeMB: 2 },
      managedImageAvailable: computed(() => true),
      googleByokAvailable: computed(() => providerState.googleAvailable),
      openAIByokAvailable: computed(() => providerState.openAIAvailable),
      nanoBananaAvailable: computed(() => false),
      gptImageAvailable: computed(() => false),
      googleByokModelId: computed(() => providerState.googleModelId),
      openAIByokModelId: computed(() => providerState.openAIModelId),
      setMode: vi.fn(),
      setImageProvider,
      uploadImages: vi.fn(),
      removeImage: vi.fn(),
      clearAllImages: vi.fn(),
      loadAbstract: vi.fn(),
      clearAbstract: vi.fn(),
      updateSpecs: vi.fn(),
      getSuggestions: vi.fn(() => []),
      applySuggestion: vi.fn(),
      hideSuggestions: vi.fn(),
      selectJournalStyle: vi.fn(),
      selectSchematicLayout: vi.fn(),
      generateImage,
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
      downloadImage: vi.fn(),
      resetAll: vi.fn(),
    }),
  };
});

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('ImageGenerationPanel provider controls', () => {
  it('uses one generation action with a compact provider selector', async () => {
    render(ImageGenerationPanel, {
      global: {
        plugins: [i18n],
        stubs: {
          TemplateButtons: true,
          ImageSpecsForm: true,
          StackedImagePreview: true,
          ImageCanvas: true,
          AbstractSelector: true,
        },
      },
    });

    expect(screen.getAllByRole('button', { name: 'Generate image' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Nanobana/i })).toBeNull();
    expect(screen.getByRole('option', { name: 'Google · gemini-3-pro-image' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'OpenAI · seedream-1.5' })).toBeTruthy();
    expect(screen.getByRole('option', { name: /🍌 Nanobanana pro · Member/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /GPT-Image · Member/ })).toBeTruthy();
    await fireEvent.update(screen.getByLabelText('Image provider'), 'openai-byok');
    expect(setImageProvider).toHaveBeenCalledWith('openai-byok');
    await fireEvent.click(screen.getByRole('button', { name: 'Generate image' }));
    expect(generateImage).toHaveBeenCalledOnce();
  });

  it('shows configuration placeholders instead of locks for missing personal image APIs', () => {
    providerState.googleAvailable = false;
    providerState.openAIAvailable = false;
    providerState.googleModelId = null;
    providerState.openAIModelId = null;

    render(ImageGenerationPanel, {
      global: {
        plugins: [i18n],
        stubs: {
          TemplateButtons: true,
          ImageSpecsForm: true,
          StackedImagePreview: true,
          ImageCanvas: true,
          AbstractSelector: true,
        },
      },
    });

    expect(
      screen.getByRole('option', { name: 'Google · 🎨 image model not configured' })
    ).toBeTruthy();
    expect(
      screen.getByRole('option', { name: 'OpenAI · 🎨 image model not configured' })
    ).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Google.*🔒/ })).toBeNull();

    providerState.googleAvailable = true;
    providerState.openAIAvailable = true;
    providerState.googleModelId = 'gemini-3-pro-image';
    providerState.openAIModelId = 'seedream-1.5';
  });
});
