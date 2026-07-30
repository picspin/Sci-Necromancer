import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import MemberAccount from './MemberAccount.vue';

const { membershipState, refreshStatus } = vi.hoisted(() => ({
  membershipState: {
    authenticated: false,
    status: null as null | { bonusBalance: number },
    error: null as string | null,
    user: null as null | Record<string, unknown>,
  },
  refreshStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/composables/useMembership', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue');
  return {
    useMembership: () => ({
      configured: true,
      turnstileSiteKey: 'test-site-key',
      isAuthenticated: computed(() => membershipState.authenticated),
      isLoading: computed(() => false),
      isStatusLoading: computed(() => false),
      passwordRecovery: computed(() => false),
      user: computed(() => membershipState.user),
      status: computed(() => membershipState.status),
      error: computed(() => membershipState.error),
      refreshStatus,
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
});
