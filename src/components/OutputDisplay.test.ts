import { createI18n } from 'vue-i18n';
import { render, screen, cleanup } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';
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
});
