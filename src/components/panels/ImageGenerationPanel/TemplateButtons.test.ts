import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import en from '../../../../public/locales/en/translation.json';
import { JOURNAL_STYLE_TEMPLATES, SCHEMATIC_LAYOUTS } from '@/src/services/imageTemplateRegistry';
import TemplateButtons from './TemplateButtons.vue';

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('ImageGenerationPanel template selector', () => {
  it('shows four primary buttons and five secondary styles in a select', () => {
    render(TemplateButtons, {
      props: {
        styles: JOURNAL_STYLE_TEMPLATES,
        layouts: SCHEMATIC_LAYOUTS,
        selectedStyle: 'nature',
        selectedLayout: 'modular-grid',
      },
      global: { plugins: [i18n] },
    });

    expect(screen.getByTestId('primary-journal-styles').children).toHaveLength(4);
    expect(
      screen.getAllByRole('option').filter((option) => !option.hasAttribute('disabled'))
    ).toHaveLength(12);
    expect(screen.queryByRole('button', { name: /MRI/i })).toBeNull();
  });

  it('emits independent style and layout selections', async () => {
    const { emitted } = render(TemplateButtons, {
      props: {
        styles: JOURNAL_STYLE_TEMPLATES,
        layouts: SCHEMATIC_LAYOUTS,
        selectedStyle: 'nature',
        selectedLayout: 'modular-grid',
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.change(screen.getByTestId('secondary-journal-styles'), {
      target: { value: 'radiology' },
    });
    await fireEvent.change(screen.getByLabelText('Schematic layout'), {
      target: { value: 'before-after' },
    });

    expect(emitted()['select-style']).toEqual([['radiology']]);
    expect(emitted()['select-layout']).toEqual([['before-after']]);
  });
});
