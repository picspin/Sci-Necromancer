import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import OncologyConferencePanel from './OncologyConferencePanel.vue';

const llmMocks = vi.hoisted(() => ({
  analyzeContentForConference: vi.fn(),
  generateAbstractForConference: vi.fn(),
  generateCreativeAbstractForConference: vi.fn(),
  generateFinalAbstract: vi.fn(),
}));

vi.mock('@/lib/llm', () => llmMocks);

vi.mock('@/lib/file/FileProcessingService', () => ({
  fileProcessingService: { processFile: vi.fn() },
}));

vi.mock('@/components/OutputDisplay.vue', () => ({
  default: {
    props: ['abstract'],
    template: '<div data-test="output-display">{{ abstract?.abstract }}</div>',
  },
}));

vi.mock('@/composables/useSettings', () => ({
  useSettings: () => ({
    settings: { value: {} },
    databaseService: {
      saveAbstract: vi.fn(),
      updateAbstract: vi.fn(),
    },
  }),
}));

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('OncologyConferencePanel', () => {
  it.each([
    ['ASCO', 'ASCO Annual Meeting 2026'],
    ['ESMO', 'ESMO Congress 2026'],
  ] as const)('renders the %s organizer profile through the shared panel', (conference, rule) => {
    render(OncologyConferencePanel, {
      props: { conference },
      global: { plugins: [i18n] },
    });

    expect(screen.getByRole('heading', { name: new RegExp(conference) })).toBeTruthy();
    expect(screen.getByText(new RegExp(rule))).toBeTruthy();
    expect((screen.getByRole('button', { name: /analyze/i }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('analyzes into the three-layer ESMO route before enabling generation', async () => {
    llmMocks.analyzeContentForConference.mockResolvedValue({
      categories: [],
      keywords: ['Artificial Intelligence', 'Clinical Trial'],
    });
    render(OncologyConferencePanel, {
      props: { conference: 'ESMO' },
      global: { plugins: [i18n] },
    });

    await fireEvent.update(
      screen.getByRole('textbox'),
      'Artificial intelligence diagnostic model in an ongoing phase II trial currently recruiting with no results.'
    );
    await fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => {
      expect(screen.getAllByText('AI for diagnostics and profiling').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/trial-in-progress/i)).toHaveLength(2);
    expect(screen.getByText(/poster/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /generate/i }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('generates from the organizer prompt and exposes the aligned post-generation controls', async () => {
    llmMocks.analyzeContentForConference.mockResolvedValue({
      categories: [],
      keywords: ['Clinical Trial'],
    });
    llmMocks.generateAbstractForConference.mockResolvedValue({
      title: 'A phase III oncology trial',
      abstract: 'Background: Test. Methods: Test. Results: Test. Conclusions: Test.',
      impact: 'Test impact.',
      synopsis: 'Test synopsis.',
      keywords: ['Clinical Trial'],
    });
    render(OncologyConferencePanel, {
      props: { conference: 'ASCO' },
      global: { plugins: [i18n] },
    });

    await fireEvent.update(
      screen.getByRole('textbox'),
      'Randomized phase III breast cancer trial with final results.'
    );
    await fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await fireEvent.click(await screen.findByRole('button', { name: /generate/i }));

    await waitFor(() => expect(llmMocks.generateAbstractForConference).toHaveBeenCalledOnce());
    expect(llmMocks.generateAbstractForConference.mock.calls[0][0]).toContain(
      'ASCO Annual Meeting 2026'
    );
    expect(llmMocks.generateAbstractForConference.mock.calls[0][0]).toContain('Never invent');
    expect(llmMocks.generateAbstractForConference.mock.calls[0][4]).toBe('ASCO');
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /clear/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /deep update/i })).toBeTruthy();
  });

  it('keeps the shared creative mode as a single organizer-aware action', async () => {
    llmMocks.generateCreativeAbstractForConference.mockResolvedValue({
      title: 'Concept abstract',
      abstract: 'Background: Concept. Methods: Author confirmation required.',
      impact: 'Potential impact.',
      synopsis: 'Concept synopsis.',
      keywords: ['Precision Medicine'],
    });
    render(OncologyConferencePanel, {
      props: { conference: 'ESMO' },
      global: { plugins: [i18n] },
    });

    await fireEvent.click(screen.getByRole('button', { name: /creative expansion|邪修模式/i }));
    await fireEvent.update(screen.getByRole('textbox'), 'A precision oncology concept');
    await fireEvent.click(screen.getByRole('button', { name: /generate creatively/i }));

    await waitFor(() =>
      expect(llmMocks.generateCreativeAbstractForConference).toHaveBeenCalledOnce()
    );
    expect(llmMocks.generateCreativeAbstractForConference.mock.calls[0][0]).toContain(
      'ESMO Congress 2026'
    );
    expect(screen.queryByRole('button', { name: /analyze/i })).toBeNull();
  });
});
