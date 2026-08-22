import { createI18n } from 'vue-i18n';
import { defineComponent, h } from 'vue';
import { fireEvent, render, screen, cleanup } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Conference } from '@/types';
import en from '../../public/locales/en/translation.json';
import OutputDisplay from './OutputDisplay.vue';

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('OutputDisplay blind-review entry', () => {
  afterEach(cleanup);

  it.each<Conference>(['ISMRM', 'RSNA', 'ER', 'ESC'])(
    'uses the shared control for %s',
    (conference) => {
      render(OutputDisplay, {
        props: {
          abstract: { impact: '', synopsis: '', abstract: 'Generated abstract', keywords: [] },
          sourceText: 'Original source',
          conference,
          isLoading: false,
          error: null,
        },
        global: {
          plugins: [i18n],
          stubs: {
            BlindReviewControl: {
              props: ['conference', 'sourceText', 'abstract'],
              template: '<button data-testid="shared-blind-review">Blind Review</button>',
            },
            ExportButtons: true,
            LiveRegion: true,
            AbstractBody: true,
            SvgIcon: true,
          },
        },
      });

      expect(screen.getAllByTestId('shared-blind-review')).toHaveLength(1);
    }
  );

  it('does not expose internal RSNA fallback provenance from stored or model warnings', () => {
    render(OutputDisplay, {
      props: {
        abstract: {
          impact: '',
          synopsis: '',
          abstract: 'Generated abstract',
          keywords: [],
          complianceWarnings: [
            'RSNA 2026 uses provisional RSNA 2023 fallback rules.',
            'Verify the ethics approval statement.',
          ],
        },
        conference: 'RSNA',
        isLoading: false,
        error: null,
      },
      global: {
        plugins: [i18n],
        stubs: {
          BlindReviewControl: true,
          ExportButtons: true,
          LiveRegion: true,
          AbstractBody: true,
          SvgIcon: true,
        },
      },
    });

    expect(screen.queryByText(/provisional RSNA 2023 fallback/i)).toBeNull();
    expect(screen.getByText('Verify the ethics approval statement.')).toBeTruthy();
  });

  it('highlights the non-guarantee notice only for creative-mode output', () => {
    const renderOutput = (creativeMode: boolean) =>
      render(OutputDisplay, {
        props: {
          abstract: { impact: '', synopsis: '', abstract: 'Generated abstract', keywords: [] },
          conference: 'ISMRM',
          creativeMode,
          isLoading: false,
          error: null,
        },
        global: {
          plugins: [i18n],
          stubs: {
            BlindReviewControl: true,
            ExportButtons: true,
            LiveRegion: true,
            AbstractBody: true,
            SvgIcon: true,
          },
        },
      });

    renderOutput(true);
    expect(screen.getByTestId('creative-output-warning')).toBeTruthy();
    cleanup();

    renderOutput(false);
    expect(screen.queryByTestId('creative-output-warning')).toBeNull();
  });

  it('shows and copies the journal-ready AI use acknowledgment after the abstract', async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal('alert', vi.fn());
    render(OutputDisplay, {
      props: {
        abstract: {
          impact: 'Impact',
          synopsis: 'Synopsis',
          abstract: 'Generated abstract',
          keywords: ['MRI'],
          aiAssistance: {
            disclosureVersion: 'jama-2026-v1',
            platform: {
              name: 'Sci-Necromancer',
              project: 'picspin/Sci-Necromancer',
              url: 'https://www.rad-sci.org',
            },
            generatedAt: '2026-08-22T08:00:00.000Z',
            provider: 'openai',
            model: 'gpt-5.1',
            modelType: 'large-language-model',
            mode: 'standard',
            operations: ['abstract drafting', 'language revision'],
            boundaries: ['factual claims', 'statistics', 'references'],
            methodsDisclosureRequired: true,
            authorVerificationRequired: true,
          },
        },
        conference: 'ISMRM',
        isLoading: false,
        error: null,
      },
      global: {
        plugins: [i18n],
        stubs: {
          BlindReviewControl: true,
          ExportButtons: true,
          LiveRegion: true,
          AbstractBody: true,
          SvgIcon: true,
        },
      },
    });

    expect(screen.getByText('AI Use Acknowledgment')).toBeTruthy();
    expect(screen.getByText(/gpt-5\.1 large language model provided through OpenAI/)).toBeTruthy();
    expect(screen.getByText(/also be described in the Methods section/)).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('AI USE ACKNOWLEDGMENT:\nThe authors used Sci-Necromancer')
    );
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://www.rad-sci.org'));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('also be described in the Methods section')
    );
  });

  it('adds a completed research-agent disclosure to the main copy and export payload', async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal('alert', vi.fn());
    const agentRecord = {
      disclosureVersion: 'jama-2026-v1' as const,
      platform: {
        name: 'Sci-Necromancer' as const,
        project: 'picspin/Sci-Necromancer' as const,
        url: 'https://www.rad-sci.org' as const,
      },
      generatedAt: '2026-08-22T09:00:00.000Z',
      provider: 'mga' as const,
      providerDisplayName: 'MGA',
      model: 'glm-5',
      modelType: 'research-agent' as const,
      mode: 'standard' as const,
      operations: ['read-only literature verification'],
      boundaries: ['source data', 'factual claims', 'references'],
      methodsDisclosureRequired: true,
      authorVerificationRequired: true as const,
    };
    const BlindReviewStub = defineComponent({
      emits: ['ai-assistance'],
      setup(_, { emit }) {
        let reviewCount = 0;
        return () =>
          h(
            'button',
            {
              'data-testid': 'complete-agent-review',
              onClick: () => {
                reviewCount += 1;
                emit('ai-assistance', {
                  ...agentRecord,
                  generatedAt: `2026-08-22T${String(8 + reviewCount).padStart(2, '0')}:00:00.000Z`,
                });
              },
            },
            'Complete Agent Review'
          );
      },
    });
    const ExportProbe = defineComponent({
      props: ['abstract'],
      setup(probeProps) {
        return () =>
          h(
            'span',
            { 'data-testid': 'export-assistance-count' },
            String(probeProps.abstract?.aiAssistanceRecords?.length ?? 0)
          );
      },
    });
    const view = render(OutputDisplay, {
      props: {
        abstract: {
          impact: 'Impact',
          synopsis: 'Synopsis',
          abstract: 'Generated abstract',
          keywords: ['MRI'],
        },
        sourceText: 'Source',
        conference: 'ISMRM',
        isLoading: false,
        error: null,
      },
      global: {
        plugins: [i18n],
        stubs: {
          BlindReviewControl: BlindReviewStub,
          ExportButtons: ExportProbe,
          LiveRegion: true,
          AbstractBody: true,
          SvgIcon: true,
        },
      },
    });

    await fireEvent.click(screen.getByTestId('complete-agent-review'));
    await fireEvent.click(screen.getByTestId('complete-agent-review'));

    expect(screen.getAllByText(/glm-5 research agent provided through MGA/)).toHaveLength(2);
    expect(screen.getByTestId('export-assistance-count').textContent).toBe('2');
    const abstractUpdates = view.emitted()['update:abstract'] as unknown[][];
    expect(
      (abstractUpdates.at(-1)?.[0] as { aiAssistanceRecords?: unknown[] }).aiAssistanceRecords
    ).toHaveLength(2);
    await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('glm-5 research agent'));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('also be described in the Methods section')
    );
  });
});
