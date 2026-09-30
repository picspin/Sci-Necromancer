import { createI18n } from 'vue-i18n';
import { defineComponent, h } from 'vue';
import { render } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../public/locales/en/translation.json';
import { useImageGeneration } from './useImageGeneration';
import { MemberApiError } from '@/src/services/memberApiClient';

const { generateImageForProvider, managedGenerate, membershipState, settingsState } = vi.hoisted(
  () => ({
    generateImageForProvider: vi.fn(),
    managedGenerate: vi.fn(),
    membershipState: {
      authenticated: true,
      status: { bonusBalance: 10 },
    },
    settingsState: {
      memberManagedNanoBananaEnabled: true,
      memberManagedImageEnabled: true,
      googleApiKey: 'google-key',
      googleImageModel: 'gemini-3-pro-image',
    },
  })
);

vi.mock('@/src/composables/useMembership', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useMembership: () => ({
      isAuthenticated: computed(() => membershipState.authenticated),
      status: computed(() => membershipState.status),
      managedGenerate,
    }),
  };
});

vi.mock('@/src/composables/useSettings', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue');
  return { useSettings: () => ({ settings: computed(() => settingsState) }) };
});

vi.mock('@/lib/compliance/aiDisclosure', () => ({
  requireAIDisclosureAcceptance: vi.fn(),
  createAIAssistanceRecord: vi.fn((input) => input),
}));

vi.mock('@/lib/llm', () => ({ generateImageForProvider }));

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('useImageGeneration managed result provenance', () => {
  beforeEach(() => {
    managedGenerate.mockReset();
    generateImageForProvider.mockReset();
  });

  it('defaults new and reset image workflows to member Gemini 3.1 Flash', () => {
    let imageGeneration!: ReturnType<typeof useImageGeneration>;
    const Harness = defineComponent({
      setup() {
        imageGeneration = useImageGeneration();
        return () => h('div');
      },
    });
    render(Harness, { global: { plugins: [i18n] } });

    imageGeneration.resetAll();

    expect(imageGeneration.state.value.imageProvider).toBe('mga-gemini-3.1-flash-image');
  });

  it('stores the actual model and fallback path returned by the member API', async () => {
    managedGenerate.mockResolvedValue({
      type: 'image',
      base64: 'aW1hZ2U=',
      mimeType: 'image/webp',
      requestedModel: 'gemini-3.1-flash-image',
      model: 'imagen-4',
      provider: 'mga',
      fallbackPath: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'imagen-4'],
      modelType: 'image-generation-model',
    });

    let imageGeneration!: ReturnType<typeof useImageGeneration>;
    const Harness = defineComponent({
      setup() {
        imageGeneration = useImageGeneration();
        return () => h('div');
      },
    });
    render(Harness, { global: { plugins: [i18n] } });
    imageGeneration.resetAll();
    imageGeneration.setMode('text-to-image');
    imageGeneration.setImageProvider('mga-gemini-3.1-flash-image');
    imageGeneration.updateSpecs('Create a scientific figure', 26);

    await imageGeneration.generateImage();

    expect(imageGeneration.state.value.generatedImage).toBe('data:image/webp;base64,aW1hZ2U=');
    expect(imageGeneration.state.value.provenance).toEqual({
      requestedModel: 'gemini-3.1-flash-image',
      actualModel: 'imagen-4',
      fallbackPath: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'imagen-4'],
    });
  });

  it('sends a confirmed illustration family and records only successfully used routing models', async () => {
    managedGenerate.mockResolvedValue({
      type: 'image',
      base64: 'aW1hZ2U=',
      mimeType: 'image/png',
      requestedModel: 'gemini-3.1-flash-image',
      model: 'gemini-3.1-flash-image',
      provider: 'mga',
      fallbackPath: ['gemini-3.1-flash-image'],
    });
    let imageGeneration!: ReturnType<typeof useImageGeneration>;
    const Harness = defineComponent({
      setup() {
        imageGeneration = useImageGeneration();
        return () => h('div');
      },
    });
    render(Harness, { global: { plugins: [i18n] } });
    imageGeneration.resetAll();
    imageGeneration.setMode('text-to-image');
    imageGeneration.updateSpecs('A schematic of a clinical workflow', 34);

    await imageGeneration.generateImage({
      illustrationCategory: 'clinical-workflow',
      routingModels: ['jev-1.13.0', 'jev-1.13.0'],
    });

    expect(managedGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Scientific illustration category: clinical-workflow.'),
      })
    );
    expect(imageGeneration.state.value.provenance).toEqual(
      expect.objectContaining({
        actualModel: 'gemini-3.1-flash-image',
        routingModels: ['jev-1.13.0'],
      })
    );
  });

  it('records only an eligible failed member image request and never retries automatically', async () => {
    managedGenerate.mockRejectedValueOnce(new MemberApiError('managed_provider_empty_output', 502));
    let imageGeneration!: ReturnType<typeof useImageGeneration>;
    const Harness = defineComponent({
      setup() {
        imageGeneration = useImageGeneration();
        return () => h('div');
      },
    });
    render(Harness, { global: { plugins: [i18n] } });
    imageGeneration.resetAll();
    imageGeneration.setMode('text-to-image');
    imageGeneration.updateSpecs('Synthetic study schematic', 25);

    await imageGeneration.generateImage({ illustrationCategory: 'study-design' });

    expect(managedGenerate).toHaveBeenCalledOnce();
    expect(imageGeneration.state.value.generatedImage).toBeNull();
    expect(imageGeneration.state.value.lastManagedFailure).toEqual({
      errorCode: 'managed_provider_empty_output',
      prompt: expect.stringContaining('Scientific illustration category: study-design.'),
      requestedModel: 'gemini-3.1-flash-image',
      referenceImageIds: [],
    });
    imageGeneration.setImageProvider('gpt-image-2');
    expect(imageGeneration.state.value.lastManagedFailure).toBeNull();
  });

  it('does not request retry advice for an auth or balance failure', async () => {
    managedGenerate.mockRejectedValueOnce(new MemberApiError('insufficient_bonus', 402));
    let imageGeneration!: ReturnType<typeof useImageGeneration>;
    const Harness = defineComponent({
      setup() {
        imageGeneration = useImageGeneration();
        return () => h('div');
      },
    });
    render(Harness, { global: { plugins: [i18n] } });
    imageGeneration.resetAll();
    imageGeneration.setMode('text-to-image');
    imageGeneration.updateSpecs('Synthetic study schematic', 25);
    await imageGeneration.generateImage({ illustrationCategory: 'study-design' });
    expect(imageGeneration.state.value.lastManagedFailure).toBeNull();
  });

  it('never switches a failed BYOK image request to member credits without an explicit retry', async () => {
    generateImageForProvider.mockRejectedValue(new Error('personal API unavailable'));

    let imageGeneration!: ReturnType<typeof useImageGeneration>;
    const Harness = defineComponent({
      setup() {
        imageGeneration = useImageGeneration();
        return () => h('div');
      },
    });
    render(Harness, { global: { plugins: [i18n] } });
    imageGeneration.resetAll();
    imageGeneration.setMode('text-to-image');
    imageGeneration.setImageProvider('google-byok');
    imageGeneration.updateSpecs('Create a scientific figure', 26);

    await imageGeneration.generateImage();

    expect(managedGenerate).not.toHaveBeenCalled();
    expect(imageGeneration.state.value.byokFailureProvider).toBe('google-byok');
  });
});
