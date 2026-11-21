import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { createI18n } from 'vue-i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { webcrypto } from 'node:crypto';
import { createFigureSpec } from '@/lib/figure/dataFigureTemplates';
import DataFigureWorkspace from './DataFigureWorkspace.vue';

const memberUser = ref<{ id: string } | null>({ id: 'member-1' });

const {
  inspect,
  localRender,
  dispose,
  figureRoute,
  planDataFigure,
  dataFigureVersion,
  refreshStatus,
} = vi.hoisted(() => ({
  inspect: vi.fn(),
  localRender: vi.fn(),
  dispose: vi.fn(),
  figureRoute: vi.fn(),
  planDataFigure: vi.fn(),
  dataFigureVersion: vi.fn(),
  refreshStatus: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/src/composables/useMembership', () => ({
  useMembership: () => ({
    isAuthenticated: { value: true },
    status: { value: { bonusBalance: 10 } },
    jevEnabled: { value: true },
    jevConsent: { value: { accepted: true, version: 'typesafe-member-2026-09-21-v1' } },
    user: memberUser,
    memberApi: { figureRoute, planDataFigure, dataFigureVersion },
    refreshStatus,
  }),
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
function mount(canRender = true, localValidation = false) {
  return render(DataFigureWorkspace, {
    props: { canRender, localValidation },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: {} })] },
  });
}
afterEach(() => {
  vi.clearAllMocks();
  memberUser.value = { id: 'member-1' };
  vi.unstubAllGlobals();
});

describe('data figure workspace', () => {
  it('plans through the member API only after assessment, then requires confirmation and settlement', async () => {
    vi.stubGlobal('crypto', webcrypto);
    inspect.mockResolvedValue({
      dataset_sha256: 'a'.repeat(64),
      row_count: 2,
      byte_count: 40,
      columns: [
        { id: 'col_1', name: 'SECRET_CATEGORY', kind: 'text', missing_count: 0 },
        { id: 'col_2', name: 'SECRET_VALUE', kind: 'numeric', missing_count: 0 },
      ],
    });
    figureRoute.mockResolvedValue({
      kind: 'data-template',
      decision: {
        candidates: [{ templateId: 'grouped-bar', suitability: 0.95 }],
        policyVersion: 'jev-figure-routing-v1',
        contractVersion: 'jev-data-figure-assessment-v3',
        provider: 'typesafe',
        model: 'jev-1.13.0',
        assessment: { lengthAdequacy: 0.9, contentReadiness: 0.88 },
      },
    });
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const spec = createFigureSpec(
      'a'.repeat(64),
      'grouped-bar',
      { category: 'col_1', value: 'col_2' },
      { value: 'score' },
      'nature'
    );
    planDataFigure.mockResolvedValue({
      kind: 'draft',
      versionId: id,
      spec,
      status: 'awaiting_render',
      cached: false,
      provider: 'mga',
      requestedModel: 'deepseek-v4.1-flash',
      actualModel: 'hidden-upstream-model',
    });
    localRender.mockResolvedValue({
      preview: 'iVBORw0KGgo=',
      manifest: {
        dataset_sha256: 'a'.repeat(64),
        figure_spec_sha256: 'b'.repeat(64),
        preview_sha256: 'c'.repeat(64),
        width_px: 4204,
        height_px: 2362,
        dpi: 600,
        template_version: 'grouped-bar-v1',
        style_version: 'nature-inspired-v1',
        pyodide_version: '314.0.7',
        runtime_dependencies: {},
      },
    });
    dataFigureVersion.mockImplementation(async (command) => ({
      version: {
        id,
        parentId: null,
        status: 'completed',
        datasetHash: 'a'.repeat(64),
        requestedModel: 'deepseek-v4.1-flash',
        actualProvider: 'mga',
        actualModel: 'hidden-upstream-model',
        specHash: command.specHash,
        receiptHash: command.receiptHash,
      },
      wallet: { bonusBalance: 0, heldBonus: 0, availableBonus: 0 },
    }));
    const mounted = mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Load synthetic example' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect local CSV' }));
    await screen.findByText('2 rows · 2 columns');
    await fireEvent.update(screen.getByLabelText('Figure goal'), 'Compare supplied groups');
    await fireEvent.update(screen.getByLabelText('Unit · 2'), 'score');
    await fireEvent.click(
      screen.getByLabelText('I approve sending exactly this metadata to TypeSafe')
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Assess metadata and chart types' }));
    await fireEvent.click(await screen.findByRole('button', { name: /Choose grouped-bar/ }));
    expect(planDataFigure).not.toHaveBeenCalled();
    await fireEvent.click(
      screen.getByRole('button', { name: 'Confirm metadata and plan · reserve 1 credit' })
    );
    await screen.findByText('Plan ready · confirm before rendering');
    expect(JSON.stringify(planDataFigure.mock.calls[0][0].input)).not.toMatch(
      /SECRET|Treatment|Control/
    );
    expect(localRender).not.toHaveBeenCalled();
    expect(screen.queryByText(/hidden-upstream-model/)).toBeNull();
    await fireEvent.click(screen.getByLabelText('I confirm the fields, units and frozen plan'));
    await fireEvent.click(
      screen.getByRole('button', { name: 'Generate confirmed figure · 1 credit on completion' })
    );
    await screen.findByText('Completed · 1 credit settled');
    expect(dataFigureVersion.mock.calls[0][0].operation).toBe('complete');
    expect(localRender).toHaveBeenCalledOnce();
    await mounted.rerender({ canStart: false });
    expect(screen.getByAltText('Data figure preview')).toBeTruthy();
    expect(refreshStatus).toHaveBeenCalled();
  });
  it('clears raw data when switching directly between two authenticated accounts', async () => {
    mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Load synthetic example' }));
    memberUser.value = { id: 'member-2' };
    await waitFor(() =>
      expect((screen.getByLabelText('CSV content') as HTMLTextAreaElement).value).toBe('')
    );
    expect(dispose).toHaveBeenCalled();
  });
  it('wires approved metadata to the member API, applies only explicit selection and clears the frozen plan', async () => {
    inspect.mockResolvedValue({
      dataset_sha256: 'a'.repeat(64),
      row_count: 2,
      byte_count: 40,
      columns: [
        { id: 'col_1', name: 'SECRET_CATEGORY', kind: 'text', missing_count: 0 },
        { id: 'col_2', name: 'SECRET_VALUE', kind: 'numeric', missing_count: 0 },
      ],
    });
    figureRoute.mockResolvedValue({
      kind: 'data-template',
      decision: {
        candidates: [{ templateId: 'scatter', suitability: 0.95 }],
        policyVersion: 'jev-figure-routing-v1',
        contractVersion: 'jev-data-figure-assessment-v3',
        assessment: { lengthAdequacy: 0.9, contentReadiness: 0.88 },
        provider: 'typesafe',
        model: 'jev-1.13.0',
      },
    });
    mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Load synthetic example' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect local CSV' }));
    await screen.findByText('2 rows · 2 columns');
    await fireEvent.update(screen.getByLabelText('Figure goal'), 'Compare fields');
    await fireEvent.click(
      screen.getByLabelText('I approve sending exactly this metadata to TypeSafe')
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Assess metadata and chart types' }));
    await screen.findByRole('button', { name: /Choose scatter/ });
    expect((screen.getByLabelText('Chart type') as HTMLSelectElement).value).toBe('grouped-bar');
    await fireEvent.click(screen.getByRole('button', { name: /Choose scatter/ }));
    expect((screen.getByLabelText('Chart type') as HTMLSelectElement).value).toBe('scatter');
    expect(screen.queryByLabelText('x')).toBeNull();
    expect(
      (screen.getByLabelText('I confirm the fields, units and frozen plan') as HTMLInputElement)
        .checked
    ).toBe(false);
    expect(figureRoute).toHaveBeenCalledWith(
      {
        kind: 'data-template',
        assessment: true,
        input: {
          goal: 'Compare fields',
          fields: [
            { alias: 'col_1', type: 'categorical' },
            { alias: 'col_2', type: 'continuous' },
          ],
        },
      },
      expect.any(AbortSignal)
    );
    expect(localRender).not.toHaveBeenCalled();
  });
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
    figureRoute.mockResolvedValue({
      kind: 'data-template',
      decision: {
        candidates: [{ templateId: 'grouped-bar', suitability: 0.95 }],
        policyVersion: 'jev-figure-routing-v1',
        contractVersion: 'jev-data-figure-assessment-v3',
        provider: 'typesafe',
        model: 'jev-1.13.0',
        assessment: { lengthAdequacy: 0.9, contentReadiness: 0.88 },
      },
    });
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
    const mounted = mount(true, true);
    await fireEvent.click(screen.getByRole('button', { name: 'Load synthetic example' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect local CSV' }));
    await screen.findByText('2 rows · 2 columns');
    // The development-only harness retains free manual renderer validation.
    await fireEvent.update(screen.getByLabelText('category'), 'col_1');
    await fireEvent.update(screen.getByLabelText('value'), 'col_2');
    await fireEvent.update(screen.getByLabelText('Unit · value'), 'patients');
    await fireEvent.update(screen.getByLabelText('Figure goal'), 'Compare supplied values');
    await fireEvent.click(
      screen.getByLabelText('I approve sending exactly this metadata to TypeSafe')
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Assess metadata and chart types' }));
    await fireEvent.click(await screen.findByRole('button', { name: /Choose grouped-bar/ }));
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
    await mounted.rerender({ canStart: false });
    expect(screen.getByAltText('Data figure preview')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Render local validation preview' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    await mounted.rerender({ canStart: true });
    await fireEvent.update(screen.getByLabelText('Journal-inspired style'), 'lancet');
    await waitFor(() => expect(screen.queryByAltText('Data figure preview')).toBeNull());
    expect(
      (screen.getByLabelText('I confirm the fields, units and frozen plan') as HTMLInputElement)
        .checked
    ).toBe(false);
  });
});
