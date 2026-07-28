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
});
