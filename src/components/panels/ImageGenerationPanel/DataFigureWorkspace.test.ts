import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { createI18n } from 'vue-i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DataFigureWorkspace from './DataFigureWorkspace.vue';

const { inspect, localRender, dispose } = vi.hoisted(() => ({
  inspect: vi.fn(),
  localRender: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock('@/src/services/browserFigures', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/src/services/browserFigures')>();
  return {
    ...original,
    BrowserFigureSession: class {
      inspect = inspect;
      render = localRender;
      dispose = dispose;
    },
  };
});
function mount(canRender = true) {
  return render(DataFigureWorkspace, {
    props: { canRender },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: {} })] },
  });
}
afterEach(() => {
  vi.clearAllMocks();
});

describe('data figure workspace', () => {
  it('ignores a file read that finishes after access was revoked', async () => {
    let finish!: (bytes: ArrayBuffer) => void;
    const contents = new Promise<ArrayBuffer>((resolve) => {
      finish = resolve;
    });
    const mounted = mount();
    const input = mounted.container.querySelector('input[type=file]')!;
    Object.defineProperty(input, 'files', {
      value: [{ name: 'data.csv', size: 20, arrayBuffer: () => contents }],
    });
    await fireEvent(input, new Event('change', { bubbles: true }));
    await mounted.rerender({ canRender: false });
    finish(new TextEncoder().encode('Category,Value\nA,1\n').buffer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((screen.getByLabelText('CSV content') as HTMLTextAreaElement).value).toBe('');
  });
  it('clears the dataset and cancels work when member access is lost', async () => {
    const mounted = mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Load synthetic example' }));
    expect((screen.getByLabelText('CSV content') as HTMLTextAreaElement).value).toContain(
      'Treatment'
    );
    await mounted.rerender({ canRender: false });
    expect(dispose).toHaveBeenCalled();
    expect((screen.getByLabelText('CSV content') as HTMLTextAreaElement).value).toBe('');
  });
  it('keeps member access explicit and does not offer unauthorized originals', () => {
    mount(false);
    expect(
      screen.getByRole('button', { name: 'Inspect local CSV' }).closest('fieldset')?.disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Download original · free with authorization',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getByText(/Sign in with a positive credit balance/)).toBeTruthy();
  });
  it('requires a frozen plan confirmation, invalidates changed parameters and renders a real Worker result', async () => {
    inspect.mockResolvedValue({
      dataset_sha256: 'a'.repeat(64),
      row_count: 2,
      byte_count: 40,
      columns: [
        { id: 'col_1', name: 'Category', kind: 'text', missing_count: 0 },
        { id: 'col_2', name: 'Value', kind: 'numeric', missing_count: 0 },
      ],
    });
    localRender.mockResolvedValue({
      preview: 'iVBORw0KGgo=',
      manifest: {
        width_px: 4204,
        height_px: 2362,
        dpi: 600,
        template_version: 'grouped-bar-v1',
        style_version: 'nature-inspired-v1',
        pyodide_version: '314.0.7',
        runtime_dependencies: { python: '3.14.2' },
      },
    });
    mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Load synthetic example' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect local CSV' }));
    await screen.findByText('2 rows · 2 columns');
    await fireEvent.update(screen.getByLabelText('category'), 'col_1');
    await fireEvent.update(screen.getByLabelText('value'), 'col_2');
    await fireEvent.update(screen.getByLabelText('Unit · value'), 'patients');
    expect(
      (screen.getByRole('button', { name: 'Render local validation preview' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    await fireEvent.click(screen.getByLabelText('I confirm the fields, units and frozen plan'));
    await fireEvent.click(screen.getByRole('button', { name: 'Render local validation preview' }));
    await screen.findByAltText('Data figure preview');
    expect(Array.from(localRender.mock.calls[0][0])).toEqual(
      Array.from(new TextEncoder().encode('Category,Value\nTreatment,12\nControl,9\n'))
    );
    expect(localRender.mock.calls[0][1]).toMatchObject({
      dataset_sha256: 'a'.repeat(64),
      mapping: { category: 'col_1', value: 'col_2' },
      units: { value: 'patients' },
    });
    expect(
      (
        screen.getByRole('button', {
          name: 'Download original · free with authorization',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    await fireEvent.update(screen.getByLabelText('Journal-inspired style'), 'lancet');
    await waitFor(() => expect(screen.queryByAltText('Data figure preview')).toBeNull());
    expect(
      (screen.getByLabelText('I confirm the fields, units and frozen plan') as HTMLInputElement)
        .checked
    ).toBe(false);
  });
});
