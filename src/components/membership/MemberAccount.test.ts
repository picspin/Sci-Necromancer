import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import MemberAccount from './MemberAccount.vue';

vi.mock('@/composables/useMembership', async () => {
  const { ref, computed } = await vi.importActual<typeof import('vue')>('vue');
  const user = ref(null);
  return {
    useMembership: () => ({
      configured: true,
      turnstileSiteKey: 'test-site-key',
      isAuthenticated: computed(() => false),
      isLoading: computed(() => false),
      passwordRecovery: computed(() => false),
      user,
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
    expect(screen.queryByText(/WeChat/i)).toBeNull();
    expect(screen.queryByText(/Claim 5/i)).toBeNull();

    await fireEvent.click(screen.getByRole('tab', { name: 'Register' }));
    expect(screen.getByLabelText('Nickname')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });
});
