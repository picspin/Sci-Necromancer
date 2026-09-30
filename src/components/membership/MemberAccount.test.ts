import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import MemberAccount from './MemberAccount.vue';

const { membershipState, refreshStatus, listJevGenerationVersions } = vi.hoisted(() => ({
  membershipState: {
    authenticated: false,
    jevEnabled: false,
    status: null as null | { bonusBalance: number },
    error: null as string | null,
    user: null as null | Record<string, unknown>,
  },
  refreshStatus: vi.fn().mockResolvedValue(undefined),
  listJevGenerationVersions: vi.fn().mockResolvedValue({ versions: [] }),
}));

vi.mock('@/composables/useMembership', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useMembership: () => ({
      configured: true,
      turnstileSiteKey: 'test-site-key',
      isAuthenticated: computed(() => membershipState.authenticated),
      jevEnabled: computed(() => membershipState.jevEnabled),
      isLoading: computed(() => false),
      isStatusLoading: computed(() => false),
      passwordRecovery: computed(() => false),
      user: computed(() => membershipState.user),
      status: computed(() => membershipState.status),
      error: computed(() => membershipState.error),
      refreshStatus,
      memberApi: { listJevGenerationVersions },
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
    }),
  };
});

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('MemberAccount', () => {
  it('offers email login, registration, reset, and GitHub without legacy claim or WeChat actions', async () => {
    render(MemberAccount, { global: { plugins: [i18n] } });
    expect(screen.getByRole('tab', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Register' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Reset password' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'GitHub OAuth' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GitHub Repository' }).getAttribute('href')).toBe(
      'https://github.com/picspin/sci-necromancer'
    );
    expect(screen.queryByText(/WeChat/i)).toBeNull();
    expect(screen.queryByText(/Claim 5/i)).toBeNull();

    await fireEvent.click(screen.getByRole('tab', { name: 'Register' }));
    expect(screen.getByLabelText('Nickname')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('shows a retry action when authentication succeeds but member status has not synced', async () => {
    membershipState.authenticated = true;
    membershipState.error = 'unauthenticated';
    membershipState.user = {
      email: 'member@example.com',
      user_metadata: { display_name: 'Member' },
      app_metadata: { provider: 'email' },
      identities: [],
    };
    refreshStatus.mockClear();

    render(MemberAccount, { global: { plugins: [i18n] } });
    expect(screen.getByRole('alert').textContent).toMatch(/not synced/i);
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refreshStatus).toHaveBeenCalled();

    membershipState.authenticated = false;
    membershipState.error = null;
    membershipState.user = null;
  });

  it('shows an auditable list of credit additions and deductions', () => {
    membershipState.authenticated = true;
    membershipState.error = null;
    membershipState.user = {
      email: 'member@example.com',
      user_metadata: { display_name: 'Member' },
      app_metadata: { provider: 'email' },
      identities: [],
    };
    membershipState.status = {
      bonusBalance: 8,
      checkedInToday: true,
      checkinCycle: 2,
      abstractCount: 1,
      abstractQuota: 30,
      creditHistory: [
        {
          id: 'entry-1',
          delta: -1,
          reason: 'generation',
          createdAt: '2026-08-11T10:00:00Z',
          metadata: { conference: 'RSNA' },
        },
        {
          id: 'entry-2',
          delta: 1,
          reason: 'daily_checkin',
          createdAt: '2026-08-11T08:00:00Z',
          metadata: {},
        },
      ],
    } as never;

    render(MemberAccount, { global: { plugins: [i18n] } });
    expect(screen.getByText('Credit history')).toBeTruthy();
    expect(screen.getByText('-1')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();

    membershipState.authenticated = false;
    membershipState.status = null;
    membershipState.user = null;
  });

  it('loads only the owner history on demand and shows delivered version details', async () => {
    membershipState.authenticated = true;
    membershipState.jevEnabled = true;
    membershipState.user = {
      email: 'member@example.com',
      user_metadata: {},
      app_metadata: {},
      identities: [],
    };
    listJevGenerationVersions.mockResolvedValueOnce({
      versions: [
        {
          id: 'version-1',
          taskId: 'task-1',
          operation: 'generation',
          sourceHash: 'a'.repeat(64),
          conference: 'ISMRM',
          draftText: 'Draft abstract',
          finalText: 'Delivered abstract',
          draftHash: 'b'.repeat(64),
          finalHash: 'c'.repeat(64),
          generationModels: ['glm-5.2', 'gpt-5.6-luna'],
          generationCalls: [
            { stage: 'draft', provider: 'mga', model: 'glm-5.2' },
            { stage: 'revision', provider: 'mga', model: 'gpt-5.6-luna' },
          ],
          initialCheck: null,
          finalCheck: null,
          status: 'needs_author_review',
          createdAt: '2026-09-24T10:00:00Z',
        },
      ],
    });
    render(MemberAccount, { global: { plugins: [i18n] } });
    expect(listJevGenerationVersions).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByText('Jev generation history'));
    expect(await screen.findByText('Delivered abstract')).toBeTruthy();
    expect(screen.getByText('Draft abstract')).toBeTruthy();
    expect(listJevGenerationVersions).toHaveBeenCalledWith(10);
    membershipState.authenticated = false;
    membershipState.jevEnabled = false;
    membershipState.user = null;
  });
});
