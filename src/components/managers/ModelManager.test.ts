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

vi.mock('@/composables/useMembership', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useMembership: () => ({
      configured: true,
      isAuthenticated: computed(() => false),
      status: computed(() => null),
    }),
  };
});

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en },
});

describe('ModelManager blind-review settings', () => {
  it('keeps managed image and cloud-save controls locked for visitors', async () => {
    render(ModelManager, {
      global: {
        plugins: [i18n],
        stubs: { Modal: { template: '<div><slot /></div>' } },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Member services' }));
    expect((screen.getByLabelText('Nano Banana Pro') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Supabase cloud save') as HTMLInputElement).disabled).toBe(true);
  });

  it('saves backend capability selections without endpoint fields', async () => {
    saveSettings.mockReset();
    render(ModelManager, {
      global: {
        plugins: [i18n],
        stubs: { Modal: { template: '<div><slot /></div>' } },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Skills & MCP' }));
    expect((screen.getByLabelText('Skills') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('MCP') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText(/endpoint|url|token|command/i)).toBeNull();
    const manifest = new File(
      [
        JSON.stringify({
          name: 'External reviewer',
          kind: 'skill',
          version: '1.0.0',
          adapter: 'academic-abstract-blind-review',
        }),
      ],
      'reviewer.json',
      { type: 'application/json' }
    );
    Object.defineProperty(manifest, 'text', {
      value: async () =>
        JSON.stringify({
          name: 'External reviewer',
          kind: 'skill',
          version: '1.0.0',
          adapter: 'academic-abstract-blind-review',
        }),
    });
    const manifestInput = screen.getByLabelText('Choose JSON manifest') as HTMLInputElement;
    Object.defineProperty(manifestInput, 'files', { value: [manifest], configurable: true });
    await fireEvent.change(manifestInput);
    expect(await screen.findByText('External reviewer')).toBeTruthy();
    await fireEvent.click(screen.getByLabelText(/External reviewer/));
    await fireEvent.click(screen.getByLabelText('PubMed related-literature search'));
    await fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect(saveSettings).toHaveBeenCalledOnce();
    expect(saveSettings.mock.calls[0][0].blindReview.reviewers.pubmed).toBe(true);
    expect(saveSettings.mock.calls[0][0].capabilities.imported[0].name).toBe('External reviewer');
    expect(saveSettings.mock.calls[0][0].capabilities.imported[0].enabled).toBe(true);
  });
});
