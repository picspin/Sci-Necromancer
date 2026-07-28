import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import ModelManager from './ModelManager.vue';

const { saveSettings, storedSettings } = vi.hoisted(() => ({
  saveSettings: vi.fn(),
  storedSettings: {
    provider: 'google',
    temperature: 0.7,
    maxTokens: 4000,
    databaseEnabled: false,
    blindReview: {
      enabled: true,
      reviewers: { pubmed: false, citecheck: false, 'doi-mcp': false },
    },
  },
}));

vi.mock('@/composables/useSettings', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue');
  return { useSettings: () => ({ settings: computed(() => storedSettings), saveSettings }) };
});

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en },
});

describe('ModelManager blind-review settings', () => {
  it('saves backend capability selections without endpoint fields', async () => {
    saveSettings.mockReset();
    render(ModelManager, {
      global: {
        plugins: [i18n],
        stubs: { Modal: { template: '<div><slot /></div>' } },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'MCP Tools' }));
    expect(screen.queryByLabelText(/endpoint|url|token|command/i)).toBeNull();
    await fireEvent.click(screen.getByLabelText('PubMed related-literature search'));
    await fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect(saveSettings).toHaveBeenCalledOnce();
    expect(saveSettings.mock.calls[0][0].blindReview.reviewers.pubmed).toBe(true);
  });
});
