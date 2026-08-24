import { createI18n } from 'vue-i18n';
import { render, screen } from '@testing-library/vue';
import { computed } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import { clearTextModelWorkflows, lockTextModelForAnalysis } from '@/lib/llm/textModelWorkflow';
import CurrentTextModelBadge from './CurrentTextModelBadge.vue';

const { membershipState, state } = vi.hoisted(() => ({
  membershipState: { bonusBalance: 8 },
  state: {
    settings: {
      provider: 'openai',
      openAITextModel: 'personal-model',
      textGenerationSource: 'byok',
    },
  },
}));

vi.mock('@/composables/useSettings', () => ({
  useSettings: () => ({ settings: computed(() => state.settings) }),
}));

vi.mock('@/composables/useMembership', () => ({
  useMembership: () => ({ status: computed(() => membershipState) }),
}));

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('CurrentTextModelBadge', () => {
  beforeEach(() => {
    clearTextModelWorkflows();
    membershipState.bonusBalance = 8;
  });

  it('shows the workflow snapshot rather than a later global selection', () => {
    lockTextModelForAnalysis('ER:paper-a', {
      source: 'managed',
      provider: 'mga',
      model: 'glm-5.2',
    });

    render(CurrentTextModelBadge, {
      props: { workflowContext: 'ER:paper-a' },
      global: { plugins: [i18n] },
    });

    expect(screen.getByText('Locked through generation · Member · glm-5.2')).toBeTruthy();
  });

  it('opens the member panel before a managed generation when the balance is empty', async () => {
    membershipState.bonusBalance = 0;
    state.settings = {
      provider: 'openai',
      openAITextModel: 'personal-model',
      textGenerationSource: 'managed',
      memberManagedTextModel: 'glm-5.2',
    } as typeof state.settings;
    const openMember = vi.fn();
    window.addEventListener('sci-necromancer:open-member', openMember, { once: true });

    render(CurrentTextModelBadge, {
      props: { workflowContext: 'ER:paper-a' },
      global: { plugins: [i18n] },
    });

    screen.getByRole('button', { name: 'Get credits' }).click();
    expect(openMember).toHaveBeenCalledOnce();
  });
});
