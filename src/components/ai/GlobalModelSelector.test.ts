import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { computed, nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import GlobalModelSelector from './GlobalModelSelector.vue';
import { getLockedTextModel, lockTextModelForAnalysis } from '@/lib/llm/textModelWorkflow';

const { updateSettings, state } = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  state: {
    authenticated: true,
    bonusBalance: 8,
    settings: {
      provider: 'openai',
      openAIApiKey: 'key',
      openAITextModel: 'custom-text-model',
      memberManagedTextEnabled: true,
      textGenerationSource: 'byok',
      memberManagedTextModel: 'glm-5.2',
    },
  },
}));

vi.mock('@/composables/useSettings', () => ({
  useSettings: () => ({
    settings: computed(() => state.settings),
    updateSettings,
  }),
}));

vi.mock('@/composables/useMembership', () => ({
  useMembership: () => ({
    isAuthenticated: computed(() => state.authenticated),
    status: computed(() => ({ bonusBalance: state.bonusBalance })),
  }),
}));

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('GlobalModelSelector', () => {
  afterEach(() => {
    updateSettings.mockReset();
    state.authenticated = true;
    state.bonusBalance = 8;
    state.settings = {
      provider: 'openai',
      openAIApiKey: 'key',
      openAITextModel: 'custom-text-model',
      memberManagedTextEnabled: true,
      textGenerationSource: 'byok',
      memberManagedTextModel: 'glm-5.2',
    };
  });

  it('offers BYOK and both member text models at the same decision point', async () => {
    render(GlobalModelSelector, { global: { plugins: [i18n] } });

    expect(screen.getByTestId('glass-model-selector')).toBeTruthy();
    expect(screen.getByTestId('model-selector-magic-icon')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Personal API · custom-text-model' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Member · DeepSeek V4.1 Flash' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Member · GPT-5.6 Terra' })).toBeTruthy();

    await fireEvent.update(screen.getByRole('combobox'), 'managed:gpt-5.6-terra');
    expect(updateSettings).toHaveBeenCalledWith({
      textGenerationSource: 'managed',
      memberManagedTextEnabled: true,
      memberManagedTextModel: 'gpt-5.6-terra',
    });
  });

  it('gives signed-out visitors an actionable membership CTA', async () => {
    state.authenticated = false;
    const { emitted } = render(GlobalModelSelector, { global: { plugins: [i18n] } });

    await fireEvent.click(screen.getByRole('button', { name: 'Sign in for member models' }));
    expect(emitted()['open-member']).toHaveLength(1);
  });

  it('opens membership instead of changing settings when a visitor selects a locked member model', async () => {
    state.authenticated = false;
    const { emitted } = render(GlobalModelSelector, { global: { plugins: [i18n] } });

    await fireEvent.update(screen.getByRole('combobox'), 'managed:deepseek-v4.1-flash');

    expect(emitted()['open-member']).toHaveLength(1);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('makes DeepSeek the persisted default for a signed-in member without BYOK', async () => {
    state.settings = {
      provider: 'openai',
      openAIApiKey: '',
      openAITextModel: 'custom-text-model',
      memberManagedTextEnabled: false,
      memberManagedTextModel: 'glm-5.2',
    } as typeof state.settings;

    render(GlobalModelSelector, { global: { plugins: [i18n] } });

    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe(
      'managed:deepseek-v4.1-flash'
    );
    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        textGenerationSource: 'managed',
        memberManagedTextEnabled: true,
        memberManagedTextModel: 'deepseek-v4.1-flash',
      });
    });
  });

  it('offers an explicit model switch after BYOK text failure without replaying the request', async () => {
    lockTextModelForAnalysis('ER:failed-paper', {
      source: 'byok',
      provider: 'openai',
      model: 'custom-text-model',
    });
    render(GlobalModelSelector, { global: { plugins: [i18n] } });

    window.dispatchEvent(
      new CustomEvent('sci-necromancer:byok-text-failed', {
        detail: { workflowContext: 'ER:failed-paper' },
      })
    );
    await nextTick();
    await fireEvent.click(screen.getByRole('button', { name: 'Switch to member model' }));

    expect(updateSettings).toHaveBeenCalledWith({
      textGenerationSource: 'managed',
      memberManagedTextEnabled: true,
      memberManagedTextModel: 'deepseek-v4.1-flash',
    });
    expect(getLockedTextModel('ER:failed-paper')).toBeNull();
  });
});
