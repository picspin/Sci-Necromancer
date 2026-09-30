import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../public/locales/en/translation.json';
import ImageGenerationPanel from './ImageGenerationPanel.vue';

const {
  generateImage,
  retryByokFailureWithMember,
  setImageProvider,
  figureRoute,
  panelState,
  providerState,
} = vi.hoisted(() => ({
  generateImage: vi.fn(),
  retryByokFailureWithMember: vi.fn(),
  setImageProvider: vi.fn(),
  figureRoute: vi.fn(),
  providerState: {
    imageRoute: 'byok' as 'byok' | 'managed',
    googleAvailable: true,
    openAIAvailable: true,
    googleModelId: 'gemini-3-pro-image' as string | null,
    openAIModelId: 'seedream-1.5' as string | null,
    googleSupportsEditing: true,
    openAISupportsEditing: true,
    nanoAvailable: true,
    gptAvailable: false,
  },
  panelState: {
    mode: 'standard',
    uploadedImages: [],
    abstractIntent: null,
    generatedImage: null,
    provenance: null,
    byokFailureProvider: null as 'google-byok' | 'openai-byok' | null,
    lastManagedFailure: null as null | {
      errorCode: 'managed_provider_empty_output';
      prompt: string;
      requestedModel: 'gemini-3.1-flash-image';
      referenceImageIds: string[];
    },
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
  const { computed, reactive } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useImageGeneration: () => ({
      state: computed(() => reactive(panelState)),
      finalPrompt: computed(() => reactive(panelState).specsState.customInstructions),
      canGenerate: computed(() => true),
      journalStyles: [],
      schematicLayouts: [],
      uploadedImagesCount: computed(() => 0),
      canUploadMore: computed(() => true),
      imageConstraints: { maxFiles: 8, maxFileSizeMB: 2 },
      managedImageAvailable: computed(() => true),
      selectedImageRoute: computed(() => providerState.imageRoute),
      googleByokAvailable: computed(() => providerState.googleAvailable),
      openAIByokAvailable: computed(() => providerState.openAIAvailable),
      nanoBananaAvailable: computed(() => providerState.nanoAvailable),
      gptImageAvailable: computed(() => providerState.gptAvailable),
      googleByokModelId: computed(() => providerState.googleModelId),
      openAIByokModelId: computed(() => providerState.openAIModelId),
      googleByokSupportsEditing: computed(() => providerState.googleSupportsEditing),
      openAIByokSupportsEditing: computed(() => providerState.openAISupportsEditing),
      providerSupportsCurrentMode: vi.fn(() => true),
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
      retryByokFailureWithMember,
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
      downloadImage: vi.fn(),
      resetAll: vi.fn(),
    }),
  };
});

vi.mock('@/src/composables/useMembership', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useMembership: () => ({
      jevEnabled: computed(() => true),
      jevConsent: computed(() => ({ accepted: true })),
      memberApi: { figureRoute },
    }),
  };
});

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('ImageGenerationPanel provider controls', () => {
  beforeEach(() => {
    generateImage.mockReset();
    figureRoute.mockReset();
    providerState.imageRoute = 'byok';
    panelState.lastManagedFailure = null;
  });
  afterEach(() => vi.unstubAllEnvs());
  it('uses one generation action with a compact provider selector', async () => {
    panelState.mode = 'text-to-image';
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
    expect(
      (
        screen.getByRole('option', {
          name: '🍌 Gemini 3 Pro Image · Member · 2 credits',
        }) as HTMLOptionElement
      ).disabled
    ).toBe(false);
    expect(
      (
        screen.getByRole('option', {
          name: '🍌 Gemini 3.1 Flash Image · Member · 2 credits',
        }) as HTMLOptionElement
      ).disabled
    ).toBe(false);
    expect(screen.getByRole('option', { name: /GPT-Image · Member · 2 credits/ })).toBeTruthy();
    await fireEvent.update(screen.getByLabelText('Image provider'), 'openai-byok');
    expect(setImageProvider).toHaveBeenCalledWith('openai-byok');
    await fireEvent.click(screen.getByRole('button', { name: 'Generate image' }));
    expect(generateImage).toHaveBeenCalledOnce();
    panelState.mode = 'standard';
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

  it('keeps deployed member Gemini image editing models available in editing mode', () => {
    providerState.googleSupportsEditing = false;
    panelState.mode = 'standard';

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
      (screen.getByRole('option', { name: 'Google · gemini-3-pro-image' }) as HTMLOptionElement)
        .disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole('option', {
          name: '🍌 Gemini 3 Pro Image · Member · 2 credits',
        }) as HTMLOptionElement
      ).disabled
    ).toBe(false);

    providerState.googleSupportsEditing = true;
  });

  it('offers an explicit member retry after BYOK fails instead of switching automatically', async () => {
    panelState.byokFailureProvider = 'google-byok';

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

    await fireEvent.click(screen.getByRole('button', { name: 'Switch to member model and retry' }));
    expect(retryByokFailureWithMember).toHaveBeenCalledOnce();
    panelState.byokFailureProvider = null;
  });

  it('provides a member CTA when image credits or authentication are unavailable', async () => {
    providerState.nanoAvailable = false;
    providerState.gptAvailable = false;
    const openMember = vi.fn();
    window.addEventListener('sci-necromancer:open-member', openMember, { once: true });

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

    await fireEvent.click(screen.getByRole('button', { name: 'Sign in or get credits' }));
    expect(openMember).toHaveBeenCalledOnce();
    providerState.nanoAvailable = true;
  });

  it('requires explicit member category and journal confirmation but allows manual choices', async () => {
    vi.stubEnv('VITE_TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED', 'true');
    providerState.imageRoute = 'managed';
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

    const generate = screen.getByRole('button', { name: 'Generate image' }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    await fireEvent.update(screen.getByLabelText('Scientific illustration family'), 'study-design');
    expect(generate.disabled).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm current journal style' }));
    expect(generate.disabled).toBe(false);
    await fireEvent.click(generate);
    expect(generateImage).toHaveBeenCalledWith({
      illustrationCategory: 'study-design',
      routingModels: [],
    });
    expect(figureRoute).not.toHaveBeenCalled();
  });

  it('keeps a Jev recommendation advisory until the user confirms it', async () => {
    vi.stubEnv('VITE_TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED', 'true');
    providerState.imageRoute = 'managed';
    figureRoute.mockResolvedValue({
      kind: 'illustration-category',
      decision: {
        selected: 'clinical-workflow',
        needsReview: false,
        model: 'jev-1.13.0',
        provider: 'typesafe',
        policyVersion: 'jev-figure-routing-v1',
        probability: 0.92,
      },
    });
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
    await fireEvent.click(screen.getByRole('button', { name: 'Ask Jev for a family suggestion' }));
    expect(await screen.findByRole('button', { name: 'Use this suggestion' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Generate image' }) as HTMLButtonElement).disabled
    ).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: 'Use this suggestion' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm current journal style' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Generate image' }));
    expect(generateImage).toHaveBeenCalledWith({
      illustrationCategory: 'clinical-workflow',
      routingModels: ['jev-1.13.0'],
    });
  });

  it('does not expose member Jev routing to a BYOK image request', () => {
    vi.stubEnv('VITE_TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED', 'true');
    providerState.imageRoute = 'byok';
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
    expect(screen.queryByText('Member schematic routing')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Generate image' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('checks the exact confirmed prompt once and keeps Jev findings advisory', async () => {
    vi.stubEnv('VITE_TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED', 'true');
    providerState.imageRoute = 'managed';
    figureRoute.mockResolvedValue({
      kind: 'illustration-prompt',
      decision: {
        selected: 'needs_revision',
        missing: ['relationships'],
        uncertain: ['constraints'],
        needsReview: true,
        model: 'jev-1.13.0',
        provider: 'typesafe',
        policyVersion: 'jev-figure-routing-v1',
      },
    });
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
    await fireEvent.update(screen.getByLabelText('Scientific illustration family'), 'study-design');
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm current journal style' }));
    await fireEvent.click(
      screen.getByRole('button', { name: 'Check prompt completeness with Jev' })
    );
    expect(figureRoute).toHaveBeenCalledWith({
      kind: 'illustration-prompt',
      input: {
        category: 'study-design',
        prompt: 'Create a scientific figure\nScientific illustration category: study-design.',
      },
    });
    expect(await screen.findByText(/Likely missing:/)).toBeTruthy();
    expect(screen.getByText(/Uncertain:/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Generate image' }) as HTMLButtonElement).disabled
    ).toBe(false);
    reactive(panelState).specsState.customInstructions = 'A clearer clinical workflow schematic';
    await nextTick();
    expect(
      (screen.getByLabelText('Scientific illustration family') as HTMLSelectElement).value
    ).toBe('study-design');
    expect(screen.queryByText(/Likely missing:/)).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Generate image' }) as HTMLButtonElement).disabled
    ).toBe(false);
    reactive(panelState).specsState.customInstructions = 'Create a scientific figure';
  });

  it('asks for retry advice only after a matching failed request and waits for a new user click', async () => {
    vi.stubEnv('VITE_TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED', 'true');
    providerState.imageRoute = 'managed';
    panelState.lastManagedFailure = {
      errorCode: 'managed_provider_empty_output',
      prompt: 'Create a scientific figure\nScientific illustration category: study-design.',
      requestedModel: 'gemini-3.1-flash-image',
      referenceImageIds: [],
    };
    figureRoute.mockResolvedValue({
      kind: 'illustration-retry',
      decision: {
        selected: 'retry_once',
        needsReview: false,
        probability: 0.93,
        model: 'jev-1.13.0',
        provider: 'typesafe',
        policyVersion: 'jev-figure-routing-v1',
      },
    });
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
    await fireEvent.update(screen.getByLabelText('Scientific illustration family'), 'study-design');
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm current journal style' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Ask Jev for a retry suggestion' }));
    expect(figureRoute).toHaveBeenCalledWith({
      kind: 'illustration-retry',
      input: {
        prompt: panelState.lastManagedFailure.prompt,
        category: 'study-design',
        requestedModel: 'gemini-3.1-flash-image',
        errorCode: 'managed_provider_empty_output',
      },
    });
    expect(generateImage).not.toHaveBeenCalled();
    const retry = await screen.findByRole('button', { name: 'Retry as a new 2-credit task' });
    await fireEvent.click(retry);
    expect(generateImage).toHaveBeenCalledOnce();
    expect(generateImage).toHaveBeenCalledWith({
      illustrationCategory: 'study-design',
      routingModels: ['jev-1.13.0'],
    });
    expect(screen.queryByRole('button', { name: 'Ask Jev for a retry suggestion' })).toBeNull();
    expect(screen.getByText(/already had its suggested manual retry/)).toBeTruthy();
  });

  it('does not offer a Jev retry when advice is uncertain or the failed prompt has changed', async () => {
    vi.stubEnv('VITE_TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED', 'true');
    providerState.imageRoute = 'managed';
    panelState.lastManagedFailure = {
      errorCode: 'managed_provider_empty_output',
      prompt: 'Create a scientific figure\nScientific illustration category: study-design.',
      requestedModel: 'gemini-3.1-flash-image',
      referenceImageIds: [],
    };
    figureRoute.mockResolvedValue({
      kind: 'illustration-retry',
      decision: {
        selected: 'unknown',
        needsReview: true,
        probability: null,
        model: 'jev-1.13.0',
        provider: 'typesafe',
        policyVersion: 'jev-figure-routing-v1',
      },
    });
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
    await fireEvent.update(screen.getByLabelText('Scientific illustration family'), 'study-design');
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm current journal style' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Ask Jev for a retry suggestion' }));
    expect(await screen.findByText(/not enough evidence for a retry recommendation/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry as a new 2-credit task' })).toBeNull();
    reactive(panelState).specsState.customInstructions = 'A revised scientific schematic';
    await nextTick();
    expect(screen.queryByRole('button', { name: 'Ask Jev for a retry suggestion' })).toBeNull();
    expect(screen.queryByText(/not enough evidence for a retry recommendation/)).toBeNull();
    expect(generateImage).not.toHaveBeenCalled();
    reactive(panelState).specsState.customInstructions = 'Create a scientific figure';
  });
});
