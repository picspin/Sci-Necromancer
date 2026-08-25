import { createI18n } from 'vue-i18n';
import { defineComponent, h } from 'vue';
import { render } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../public/locales/en/translation.json';
import { useImageGeneration } from './useImageGeneration';

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
