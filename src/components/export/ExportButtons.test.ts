import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import ExportButtons from './ExportButtons.vue';

const { exportToDocx } = vi.hoisted(() => ({ exportToDocx: vi.fn() }));

vi.mock('@/services/exportService', () => ({
  default: {
    exportToMarkdown: vi.fn(),
    exportToPDF: vi.fn(),
    exportToDocx,
    exportToJSON: vi.fn(),
  },
}));

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('ExportButtons', () => {
  beforeEach(() => {
    exportToDocx.mockReset();
    exportToDocx.mockResolvedValue(
      new Blob(['docx'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('exposes the existing DOCX export service in the output toolbar', async () => {
    const abstract = {
      impact: 'Impact',
      synopsis: 'Synopsis',
      abstract: 'Draft',
      keywords: ['MRI'],
    };
    render(ExportButtons, {
      props: { abstract, conference: 'RSNA', abstractType: 'RSNA Science Abstract' },
      global: { plugins: [i18n], stubs: { SvgIcon: true } },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Export as DOCX' }));

    await waitFor(() =>
      expect(exportToDocx).toHaveBeenCalledWith(abstract, 'RSNA', {
        customTitle: 'RSNA Science Abstract',
      })
    );
  });
});
