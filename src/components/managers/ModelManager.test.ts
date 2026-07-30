import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import ModelManager from './ModelManager.vue';

const { saveSettings, storedSettings, membershipState, getCapabilities } = vi.hoisted(() => ({
  saveSettings: vi.fn(),
  membershipState: { authenticated: false },
  getCapabilities: vi.fn(),
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
  const { computed, ref } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useMembership: () => ({
      configured: true,
      turnstileSiteKey: 'test-site-key',
      isAuthenticated: computed(() => membershipState.authenticated),
      isLoading: computed(() => false),
      passwordRecovery: computed(() => false),
      user: ref(null),
      status: computed(() => null),
      signInWithGitHub: vi.fn(),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      requestPasswordReset: vi.fn(),
      updatePassword: vi.fn(),
      updateProfile: vi.fn(),
      signOut: vi.fn(),
      checkIn: vi.fn(),
      createCheckout: vi.fn(),
      upgradeAbstractQuota: vi.fn(),
      memberApi: { getCapabilities },
    }),
  };
});

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en },
});

describe('ModelManager blind-review settings', () => {
  it('keeps the three managed model controls locked and links visitors to membership', async () => {
    render(ModelManager, {
      global: {
        plugins: [i18n],
        stubs: { Modal: { template: '<div><slot /></div>' } },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Member benefits' }));
    expect((screen.getByLabelText('GLM-5.2 - Text') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Nanobanana pro - Image') as HTMLInputElement).disabled).toBe(
      true
    );
    expect((screen.getByLabelText('GPT-Image - Image') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Become a member' })).toBeTruthy();
    expect(screen.getByText(/5 credits/)).toBeTruthy();
    expect(screen.getByText(/30 cloud abstracts/)).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Non-member' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Member' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GitHub Repository' }).getAttribute('href')).toBe(
      'https://github.com/picspin/sci-necromancer'
    );
    expect(screen.queryByLabelText('Supabase cloud save')).toBeNull();
  });

  it('shows explicit text and image model dropdowns for BYOK', async () => {
    render(ModelManager, {
      global: {
        plugins: [i18n],
        stubs: { Modal: { template: '<div><slot /></div>' } },
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Personal API' }));
    expect(screen.getByLabelText('Text Model')).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText('Image Model')).toBeInstanceOf(HTMLSelectElement);
    await fireEvent.click(screen.getAllByRole('button', { name: 'Enter a model ID manually' })[0]);
    expect(screen.getByLabelText('Custom text model ID')).toBeInstanceOf(HTMLInputElement);
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

  it('lets members enable the managed research agent and its read-only MGA sources', async () => {
    membershipState.authenticated = true;
    getCapabilities.mockResolvedValue({
      capabilities: [
        {
          id: 'mga-pubmed',
          kind: 'mcp',
          labelKey: 'model_manager.capability_pubmed',
          descriptionKey: 'model_manager.capability_pubmed_help',
          readOnly: true,
          memberOnly: true,
          bonusCost: 0,
        },
        {
          id: 'mga-semantic-scholar',
          kind: 'mcp',
          labelKey: 'model_manager.capability_semantic_scholar',
          descriptionKey: 'model_manager.capability_semantic_scholar_help',
          readOnly: true,
          memberOnly: true,
          bonusCost: 0,
        },
        {
          id: 'mga-hubble-literature-abstracts',
          kind: 'mcp',
          labelKey: 'model_manager.capability_hubble_abstracts',
          descriptionKey: 'model_manager.capability_hubble_abstracts_help',
          readOnly: true,
          memberOnly: true,
          bonusCost: 0,
        },
        {
          id: 'mga-research-verification-agent',
          kind: 'agent',
          labelKey: 'model_manager.capability_research_agent',
          descriptionKey: 'model_manager.capability_research_agent_help',
          readOnly: true,
          memberOnly: true,
          bonusCost: 1,
        },
      ],
    });
    saveSettings.mockReset();

    render(ModelManager, {
      global: { plugins: [i18n], stubs: { Modal: { template: '<div><slot /></div>' } } },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Skills & MCP' }));
    expect(await screen.findByLabelText('PubMed')).toBeInstanceOf(HTMLInputElement);
    await fireEvent.click(screen.getByLabelText('PubMed'));
    await fireEvent.click(screen.getByLabelText('Research Verification Agent'));
    await fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect(saveSettings.mock.calls[0][0].capabilities.managedEnabledIds).toEqual([
      'mga-pubmed',
      'mga-research-verification-agent',
    ]);
    membershipState.authenticated = false;
  });
});
