import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import { HelpAssistantError } from '@/src/services/helpAssistantClient';
import DocumentationAssistant from './DocumentationAssistant.vue';

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('DocumentationAssistant', () => {
  beforeEach(() => sessionStorage.clear());

  it('answers a guest shortcut from local documentation without calling AI', async () => {
    const ask = vi.fn();
    render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
        ask,
      },
      global: { plugins: [i18n] },
    });

    expect(screen.getAllByTestId('help-suggested-question')).toHaveLength(6);
    await fireEvent.click(
      screen.getByRole('button', { name: 'How do I configure the Anthropic API?' })
    );

    expect(screen.getByText(/Anthropic Messages supports text only/)).toBeTruthy();
    expect(ask).not.toHaveBeenCalled();
  });

  it('lets visitors browse all eight help topics without using AI', async () => {
    render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Browse all help topics' }));

    expect(screen.getAllByTestId('help-topic')).toHaveLength(8);
  });

  it('requires the one-time AI disclosure before an assisted answer', async () => {
    const ask = vi.fn().mockResolvedValue({
      mode: 'assisted',
      text: 'HTTP 429 indicates that the configured provider is rate limiting requests.',
      citations: [{ articleId: 'troubleshooting', title: 'Common troubleshooting' }],
      shortcuts: ['open-model-settings'],
      remaining: 2,
    });
    render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
        ask,
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.update(screen.getByRole('textbox'), 'API error 429');
    await fireEvent.click(screen.getByRole('button', { name: 'Ask Sci Guide' }));

    expect(ask).not.toHaveBeenCalled();
    expect(screen.getByText(/AI-generated answers may be inaccurate/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'I understand and continue' }));

    expect(await screen.findByText(/provider is rate limiting requests/)).toBeTruthy();
    expect(screen.getByText('Common troubleshooting')).toBeTruthy();
    expect(ask).toHaveBeenCalledOnce();
  });

  it('offers Turnstile verification and retries the first assisted guest question', async () => {
    sessionStorage.setItem('help-ai-disclosure', 'accepted');
    const ask = vi
      .fn()
      .mockRejectedValueOnce(new HelpAssistantError('turnstile_required', 400, 3))
      .mockResolvedValueOnce({
        mode: 'assisted',
        text: 'Use the troubleshooting steps.',
        citations: [{ articleId: 'troubleshooting', title: 'Common troubleshooting' }],
        shortcuts: [],
        remaining: 2,
      });
    render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
        turnstileSiteKey: 'site-key',
        ask,
      },
      global: {
        plugins: [i18n],
        stubs: {
          TurnstileChallenge: {
            template:
              '<button type="button" @click="$emit(\'token\', \'verified-token\')">Verify</button>',
          },
        },
      },
    });

    await fireEvent.update(screen.getByRole('textbox'), 'API error 429');
    await fireEvent.click(screen.getByRole('button', { name: 'Ask Sci Guide' }));
    expect(await screen.findByRole('button', { name: 'Verify' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Retry question' }));

    expect(await screen.findByText('Use the troubleshooting steps.')).toBeTruthy();
    expect(ask.mock.calls[1][0]).toMatchObject({ turnstileToken: 'verified-token' });
  });

  it('escalates an unresolved answer to the allowlisted GitHub Issues action', async () => {
    const rendered = render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.click(
      screen.getByRole('button', { name: 'How do I configure the Anthropic API?' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Not resolved' }));

    expect(rendered.emitted().navigate?.[0]).toEqual(['open-github-issues']);
  });

  it('blocks likely secrets in the browser before any help request is sent', async () => {
    sessionStorage.setItem('help-ai-disclosure', 'accepted');
    const ask = vi.fn();
    render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
        ask,
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.update(screen.getByRole('textbox'), 'My key is sk-1234567890abcdefghijklmnop');
    await fireEvent.click(screen.getByRole('button', { name: 'Ask Sci Guide' }));

    expect(screen.getByRole('alert').textContent).toMatch(/sensitive information/i);
    expect(ask).not.toHaveBeenCalled();
  });

  it('starts a fresh local conversation without calling the server', async () => {
    const ask = vi.fn();
    render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
        ask,
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.click(
      screen.getByRole('button', { name: 'How do I configure the Anthropic API?' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Start new conversation' }));

    expect(screen.queryByText(/Anthropic Messages supports text only/)).toBeNull();
    expect(screen.getAllByTestId('help-suggested-question')).toHaveLength(6);
    expect(ask).not.toHaveBeenCalled();
  });

  it('closes on Escape so focus can return to the launcher', async () => {
    const rendered = render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(rendered.emitted().close).toHaveLength(1);
  });

  it('moves keyboard focus into the assistant when it opens', async () => {
    render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
      },
      global: { plugins: [i18n] },
    });

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox')));
  });

  it('sends only the local conversation context with a follow-up AI question', async () => {
    sessionStorage.setItem('help-ai-disclosure', 'accepted');
    const ask = vi.fn().mockResolvedValue({
      mode: 'assisted',
      text: 'Check the provider rate-limit response headers.',
      citations: [{ articleId: 'troubleshooting', title: 'Common troubleshooting' }],
      shortcuts: [],
    });
    render(DocumentationAssistant, {
      props: {
        isOpen: true,
        authenticated: false,
        pageContext: { authenticated: false },
        ask,
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.update(screen.getByRole('textbox'), 'API error 429');
    await fireEvent.click(screen.getByRole('button', { name: 'Ask Sci Guide' }));
    await screen.findByText('Check the provider rate-limit response headers.');
    await fireEvent.update(screen.getByRole('textbox'), 'API error 429 again');
    await fireEvent.click(screen.getByRole('button', { name: 'Ask Sci Guide' }));

    expect(ask.mock.calls[1][0].history).toEqual([
      { role: 'user', content: 'API error 429' },
      { role: 'assistant', content: 'Check the provider rate-limit response headers.' },
    ]);
  });
});
