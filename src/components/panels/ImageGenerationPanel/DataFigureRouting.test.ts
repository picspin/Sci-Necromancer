import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { createI18n } from 'vue-i18n';
import { describe, expect, it, vi } from 'vitest';
import DataFigureRouting from './DataFigureRouting.vue';
import { MemberApiError } from '@/src/services/memberApiClient';

const profile = {
  dataset_sha256: 'a'.repeat(64),
  row_count: 2,
  byte_count: 100,
  columns: [
    { id: 'col_1', name: 'Patient_Name_SECRET', kind: 'text', missing_count: 0 },
    { id: 'col_2', name: 'Result_SECRET', kind: 'numeric', missing_count: 0 },
  ],
};
const decision = {
  candidates: [
    { templateId: 'scatter', suitability: 0.93 },
    { templateId: 'trend', suitability: 0.91 },
  ],
  policyVersion: 'jev-figure-routing-v1',
  contractVersion: 'jev-data-figure-routing-v2',
  provider: 'typesafe',
  model: 'jev-1.13.0',
};
function mount(request = vi.fn().mockResolvedValue(decision), canRequest = true) {
  return {
    request,
    ...render(DataFigureRouting, {
      props: { profile, canRequest, contextKey: 'member-1:consent-v1', request },
      global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: {} })] },
    }),
  };
}
async function approve() {
  await fireEvent.update(screen.getByLabelText('Figure goal'), 'Compare the supplied values');
  await fireEvent.click(
    screen.getByLabelText('I approve sending exactly this metadata to TypeSafe')
  );
}
describe('data figure routing approval', () => {
  it('requires assessment scores, hides models and emits the exact approved metadata only after a candidate choice', async () => {
    const assessed = {
      ...decision,
      contractVersion: 'jev-data-figure-assessment-v3',
      assessment: { lengthAdequacy: 0.9, contentReadiness: 0.78 },
    };
    const request = vi.fn().mockResolvedValueOnce(decision).mockResolvedValueOnce(assessed);
    const mounted = mount(request);
    await mounted.rerender({ assessment: true });
    await approve();
    await fireEvent.click(screen.getByRole('button', { name: 'Assess metadata and chart types' }));
    await screen.findByRole('alert');
    expect(mounted.emitted().assessed).toBeUndefined();
    await fireEvent.click(screen.getByRole('button', { name: 'Assess metadata and chart types' }));
    await screen.findByText('Length adequacy · 90.00');
    expect(screen.getByText('Content readiness · 78.00')).toBeTruthy();
    expect(screen.queryByText(/jev-1.13.0/)).toBeNull();
    expect(mounted.emitted().assessed).toBeUndefined();
    await fireEvent.click(screen.getByRole('button', { name: /Choose scatter/ }));
    expect(mounted.emitted().assessed).toEqual([
      [{ template: 'scatter', input: request.mock.calls[1][0] }],
    ]);
    expect(request.mock.calls[1][0].goal).toBe('Compare the supplied values');
    await fireEvent.update(screen.getByLabelText('Figure goal'), 'Changed goal');
    expect(screen.queryByText('Length adequacy · 90.00')).toBeNull();
    expect(
      (
        screen.getByLabelText(
          'I approve sending exactly this metadata to TypeSafe'
        ) as HTMLInputElement
      ).checked
    ).toBe(false);
  });

  it('resets a failed request so an explicit retry works, while rapid duplicate clicks do not re-send', async () => {
    let reject!: (error: Error) => void;
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          })
      )
      .mockResolvedValue(decision);
    const mounted = mount(request);
    await approve();
    await fireEvent.click(screen.getByRole('button', { name: 'Get template suggestions' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Assessing this metadata…' }));
    reject(new TypeError('network lost'));
    await screen.findByRole('alert');
    expect(request).toHaveBeenCalledOnce();
    await fireEvent.click(screen.getByRole('button', { name: 'Get template suggestions' }));
    await screen.findByRole('button', { name: /Choose scatter/ });
    expect(mounted.request).toHaveBeenCalledTimes(2);
  });
  it('blocks duplicate submission and locks choices during local rendering without discarding results', async () => {
    let finish!: (value: unknown) => void;
    const request = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const mounted = mount(request);
    await approve();
    await fireEvent.click(screen.getByRole('button', { name: 'Get template suggestions' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Assessing this metadata…' }));
    expect(request).toHaveBeenCalledOnce();
    finish(decision);
    await screen.findByRole('button', { name: /Choose scatter/ });
    await mounted.rerender({ locked: true });
    expect(
      (screen.getByRole('button', { name: /Choose scatter/ }) as HTMLButtonElement).disabled
    ).toBe(true);
    await mounted.rerender({ locked: false });
    expect(
      (screen.getByRole('button', { name: /Choose scatter/ }) as HTMLButtonElement).disabled
    ).toBe(false);
    expect(request).toHaveBeenCalledOnce();
  });
  it('requires explicit preview approval; sends no original names, CSV rows, hashes or automatic requests', async () => {
    const mounted = mount();
    expect(mounted.request).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: 'Get template suggestions' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    await approve();
    await fireEvent.click(screen.getByRole('button', { name: 'Get template suggestions' }));
    await screen.findByRole('button', { name: /Choose scatter/ });
    const [input, signal] = mounted.request.mock.calls[0];
    expect(input).toEqual({
      fields: [
        { alias: 'col_1', type: 'categorical' },
        { alias: 'col_2', type: 'continuous' },
      ],
      goal: 'Compare the supplied values',
    });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(input)).not.toContain('SECRET');
    expect(mounted.emitted().select).toBeUndefined();
    await fireEvent.click(screen.getByRole('button', { name: /Choose scatter/ }));
    expect(mounted.emitted().select).toEqual([['scatter']]);
    await fireEvent.update(screen.getByLabelText('Figure goal'), 'A different goal');
    expect(screen.queryByRole('button', { name: /Choose scatter/ })).toBeNull();
    expect(
      (
        screen.getByLabelText(
          'I approve sending exactly this metadata to TypeSafe'
        ) as HTMLInputElement
      ).checked
    ).toBe(false);
    expect(mounted.request).toHaveBeenCalledOnce();
  });
  it.each(['cancel', 'dataset', 'access', 'context', 'unmount'])(
    'ignores late results after %s, without retry',
    async (reason) => {
      let finish!: (value: unknown) => void;
      const request = vi.fn(
        (_input: unknown, _signal: AbortSignal) =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
      const mounted = mount(request);
      await approve();
      await fireEvent.click(screen.getByRole('button', { name: 'Get template suggestions' }));
      const signal = request.mock.calls[0][1] as AbortSignal;
      if (reason === 'cancel')
        await fireEvent.click(screen.getByRole('button', { name: 'Cancel suggestions' }));
      if (reason === 'dataset')
        await mounted.rerender({ profile: { ...profile, dataset_sha256: 'b'.repeat(64) } });
      if (reason === 'access') await mounted.rerender({ canRequest: false });
      if (reason === 'context') await mounted.rerender({ contextKey: 'member-2:consent-v1' });
      if (reason === 'unmount') mounted.unmount();
      expect(signal.aborted).toBe(true);
      finish(decision);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.queryByRole('button', { name: /Choose scatter/ })).toBeNull();
      expect(request).toHaveBeenCalledOnce();
    }
  );
  it('blocks unavailable access and oversized metadata without sending anything', async () => {
    const mounted = mount(undefined, false);
    await approve();
    expect(
      (screen.getByRole('button', { name: 'Get template suggestions' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    await mounted.rerender({
      canRequest: true,
      profile: {
        ...profile,
        columns: Array.from({ length: 33 }, (_, n) => ({ ...profile.columns[0], id: `col_${n}` })),
      },
    });
    expect(screen.getByText(/At most 32/)).toBeTruthy();
    expect(mounted.request).not.toHaveBeenCalled();
  });
  it.each([202, 401, 402, 403, 404, 429, 503])(
    'shows a recoverable %s state and manual choice, not paid fallback',
    async (status) => {
      const mounted = mount(vi.fn().mockRejectedValue(new MemberApiError('synthetic', status)));
      await approve();
      await fireEvent.click(screen.getByRole('button', { name: 'Get template suggestions' }));
      await screen.findByRole('alert');
      await fireEvent.click(screen.getByRole('button', { name: 'Choose a template manually' }));
      expect(mounted.emitted().manual).toHaveLength(1);
      expect(mounted.request).toHaveBeenCalledOnce();
    }
  );
  it('supports no match and rejects malformed recommendations atomically', async () => {
    const mounted = mount(
      vi
        .fn()
        .mockResolvedValueOnce({ ...decision, candidates: [] })
        .mockResolvedValueOnce({
          ...decision,
          candidates: [{ templateId: 'roc-pr', suitability: 0.99 }],
        })
    );
    await approve();
    await fireEvent.click(screen.getByRole('button', { name: 'Get template suggestions' }));
    await screen.findByText(/No template exceeded 80/);
    await fireEvent.click(screen.getByRole('button', { name: 'Get template suggestions' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /Choose roc/ })).toBeNull();
    await waitFor(() => expect(mounted.request).toHaveBeenCalledTimes(2));
  });
});
