import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import en from '../public/locales/en/translation.json';
import App from './App.vue';

vi.mock('@/composables/useMembership', () => ({
  useMembership: () => ({
    initialize: vi.fn(),
    isAuthenticated: ref(false),
    status: ref(null),
    getAccessToken: vi.fn().mockResolvedValue(null),
  }),
}));
vi.mock('@/components/panels/ConferencePanel.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/components/managers/AbstractManager.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/components/managers/ModelManager.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/components/membership/MemberPanel.vue', () => ({ default: { template: '<div />' } }));

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('App documentation assistant integration', () => {
  it('opens Sci Guide from the floating launcher and restores focus after closing', async () => {
    render(App, {
      global: {
        plugins: [i18n],
        stubs: {
          ConferencePanel: true,
          AbstractManager: true,
          ModelManager: true,
          MemberPanel: true,
          NotificationDisplay: true,
          LanguageSelector: true,
          AIDisclosure: true,
          GitHubRepoLink: true,
        },
      },
    });

    const launcher = screen.getByRole('button', { name: 'Open Sci Guide' });
    await fireEvent.click(launcher);
    expect(screen.getByRole('dialog', { name: 'Sci Guide' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Close Sci Guide' }));
    expect(screen.queryByRole('dialog', { name: 'Sci Guide' })).toBeNull();
    expect(document.activeElement).toBe(launcher);
  });
});
