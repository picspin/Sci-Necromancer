import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../public/locales/en/translation.json';
import ImageGenerationPanel from './ImageGenerationPanel.vue';

const { generateImage, setImageProvider, panelState } = vi.hoisted(() => ({
  generateImage: vi.fn(),
  setImageProvider: vi.fn(),
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
      googleByokAvailable: computed(() => true),
      openAIByokAvailable: computed(() => true),
      nanoBananaAvailable: computed(() => false),
      gptImageAvailable: computed(() => false),
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
    expect(screen.getByRole('option', { name: 'Google BYOK' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'OpenAI-compatible BYOK' })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Imagen 4 · Member/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /GPT Image 1 · Member/ })).toBeTruthy();
    await fireEvent.update(screen.getByLabelText('Image provider'), 'openai-byok');
    expect(setImageProvider).toHaveBeenCalledWith('openai-byok');
    await fireEvent.click(screen.getByRole('button', { name: 'Generate image' }));
    expect(generateImage).toHaveBeenCalledOnce();
  });
});
