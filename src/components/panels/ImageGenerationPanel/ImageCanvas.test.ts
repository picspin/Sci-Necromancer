import { createI18n } from 'vue-i18n';
import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import en from '../../../../public/locales/en/translation.json';
import ImageCanvas from './ImageCanvas.vue';

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('ImageCanvas generation provenance', () => {
  it('shows the actual model and fallback path beside a generated image', () => {
    render(ImageCanvas, {
      props: {
        image: 'data:image/png;base64,aW1hZ2U=',
        isLoading: false,
        zoomLevel: 100,
        provenance: {
          requestedModel: 'gemini-3.1-flash-image',
          actualModel: 'imagen-4',
          fallbackPath: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'imagen-4'],
        },
      },
      global: { plugins: [i18n] },
    });

    expect(screen.getByText('Actual model: imagen-4')).toBeTruthy();
    expect(
      screen.getByText('Fallback: gemini-3.1-flash-image → gemini-3-pro-image → imagen-4')
    ).toBeTruthy();
  });
});
