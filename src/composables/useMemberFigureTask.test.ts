import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { useMemberFigureTask } from './useMemberFigureTask';
import { createFigureSpec } from '@/lib/figure/dataFigureTemplates';

const ID = '550e8400-e29b-41d4-a716-446655440000';
const HASH = 'a'.repeat(64);
const input = () => ({
  templateId: 'grouped-bar' as const,
  styleId: 'nature' as const,
  goal: 'Compare values',
  fields: [
    { id: 'col_1', alias: 'group', type: 'categorical' as const },
    { id: 'col_2', alias: 'value', type: 'continuous' as const, unit: 'score' },
  ],
});
function setup() {
  vi.stubGlobal('crypto', webcrypto);
  let owner: string | null = 'member-1',
    allowed = true;
  const spec = createFigureSpec(
    HASH,
    'grouped-bar',
    { category: 'col_1', value: 'col_2' },
    { value: 'score' },
    'nature'
  );
  const draft = {
    kind: 'draft',
    versionId: ID,
    spec,
    status: 'awaiting_render',
    cached: false,
    provider: 'mga',
    requestedModel: 'deepseek-v4.1-flash',
    actualModel: 'upstream-deepseek',
  };
  const preview = {
    preview: 'iVBORw0KGgo=',
    manifest: {
      dataset_sha256: HASH,
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
  };
  const version = (
    status = 'awaiting_render',
    specHash: string | null = null,
    receiptHash: string | null = null
  ) => ({
    version: {
      id: ID,
      parentId: null,
      status,
      requestedModel: 'deepseek-v4.1-flash',
      actualProvider: 'mga',
      actualModel: 'upstream-deepseek',
      datasetHash: HASH,
      specHash,
      receiptHash,
      createdAt: '2026-11-21T01:00:00Z',
      leaseExpiresAt: '2026-11-21T01:15:00Z',
      settledAt: status === 'completed' ? '2026-11-21T01:01:00Z' : null,
    },
    wallet: {
      bonusBalance: status === 'completed' ? 0 : 1,
      heldBonus: status === 'awaiting_render' ? 1 : 0,
      availableBonus: 0,
    },
  });
  const api = {
    planDataFigure: vi.fn().mockResolvedValue(draft),
    dataFigureVersion: vi.fn().mockImplementation(async (command) => {
      if (command.operation === 'complete')
        return version('completed', command.specHash, command.receiptHash);
      if (command.operation === 'cancel')
        return {
          ...version('cancelled'),
          wallet: { bonusBalance: 1, heldBonus: 0, availableBonus: 1 },
        };
      if (command.operation === 'fail')
        return {
          ...version('failed'),
          wallet: { bonusBalance: 1, heldBonus: 0, availableBonus: 1 },
        };
      throw new Error('unexpected status request');
    }),
  };
  const render = vi.fn().mockResolvedValue(preview);
  const task = useMemberFigureTask(api, { owner: () => owner, canStart: () => allowed, render });
  const start = () =>
    task.start({ datasetHash: HASH, model: 'deepseek-v4.1-flash', input: input() });
  return {
    task,
    api,
    render,
    start,
    spec,
    draft,
    version,
    preview,
    owner: (value: string | null) => {
      owner = value;
    },
    allowed: (value: boolean) => {
      allowed = value;
    },
  };
}
afterEach(() => vi.unstubAllGlobals());

describe('member figure task state', () => {
  it('requires a second confirmation, locks duplicate clicks and only completes after server settlement', async () => {
    const s = setup();
    await Promise.all([s.start(), s.start()]);
    expect(s.api.planDataFigure).toHaveBeenCalledOnce();
    expect(s.task.state.value.phase).toBe('draft');
    expect(s.render).not.toHaveBeenCalled();
    expect(s.api.dataFigureVersion).not.toHaveBeenCalled();
    await Promise.all([s.task.confirm(), s.task.confirm()]);
    expect(s.render).toHaveBeenCalledOnce();
    expect(s.api.dataFigureVersion).toHaveBeenCalledOnce();
    expect(s.api.dataFigureVersion.mock.calls[0][0]).toMatchObject({
      operation: 'complete',
      versionId: ID,
      specHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      receiptHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(s.api.dataFigureVersion.mock.calls[0][0].specHash).not.toBe(
      s.preview.manifest.figure_spec_sha256
    );
    expect(s.task.state.value).toMatchObject({
      phase: 'completed',
      preview: s.preview,
      wallet: { bonusBalance: 0 },
    });
    expect(s.task.busy.value).toBe(false);
  });
  it('retains one frozen request after an unknown plan response, without allowing a new task', async () => {
    const s = setup();
    s.api.planDataFigure.mockRejectedValueOnce(new TypeError('network'));
    const command = { datasetHash: HASH, model: 'deepseek-v4.1-flash' as const, input: input() };
    await s.task.start(command);
    expect(s.task.state.value.phase).toBe('unknown');
    command.input.goal = 'Changed locally';
    await s.start();
    expect(s.api.planDataFigure).toHaveBeenCalledOnce();
    await s.task.recover();
    expect(s.api.planDataFigure).toHaveBeenCalledTimes(2);
    expect(s.api.planDataFigure.mock.calls[1][0]).toEqual(s.api.planDataFigure.mock.calls[0][0]);
    expect(s.api.planDataFigure.mock.calls[1][0].input.goal).toBe('Compare values');
    expect(s.task.state.value.phase).toBe('draft');
  });
  it('recovers a pending plan with the same key and never auto-renders', async () => {
    const s = setup();
    s.api.planDataFigure.mockResolvedValueOnce({ kind: 'pending', versionId: ID });
    await s.start();
    expect(s.task.state.value.phase).toBe('pending');
    await s.task.recover();
    expect(s.task.state.value.phase).toBe('draft');
    expect(s.api.planDataFigure.mock.calls[0][0].idempotencyKey).toBe(
      s.api.planDataFigure.mock.calls[1][0].idempotencyKey
    );
    expect(s.render).not.toHaveBeenCalled();
  });
  it('can abandon an unidentified plan locally without reporting a server cancellation', async () => {
    const s = setup();
    s.api.planDataFigure.mockRejectedValueOnce(new TypeError('network'));
    await s.start();
    s.task.abandon();
    expect(s.task.state.value).toEqual({ phase: 'idle' });
    expect(s.task.locked.value).toBe(false);
    expect(s.api.dataFigureVersion).not.toHaveBeenCalled();
    await s.start();
    expect(s.task.state.value.phase).toBe('draft');
    expect(s.api.planDataFigure.mock.calls[1][0].idempotencyKey).not.toBe(
      s.api.planDataFigure.mock.calls[0][0].idempotencyKey
    );
    s.task.abandon();
    expect(s.task.state.value.phase).toBe('draft');
  });
  it('exposes missing inputs without locking the task or rendering', async () => {
    const s = setup();
    s.api.planDataFigure.mockResolvedValueOnce({
      kind: 'needs_input',
      versionId: ID,
      missing: ['fields.col_2.unit'],
    });
    await s.start();
    expect(s.task.state.value).toMatchObject({
      phase: 'needs_input',
      missing: ['fields.col_2.unit'],
    });
    expect(s.task.locked.value).toBe(false);
    expect(s.render).not.toHaveBeenCalled();
  });
  it('confirms a terminal plan through status without rendering or settling', async () => {
    const s = setup();
    s.api.planDataFigure.mockResolvedValueOnce({
      kind: 'terminal',
      versionId: ID,
      status: 'expired',
    });
    s.api.dataFigureVersion.mockResolvedValueOnce({
      ...s.version('expired'),
      wallet: { bonusBalance: 1, heldBonus: 0, availableBonus: 1 },
    });
    await s.start();
    expect(s.task.state.value.phase).toBe('expired');
    expect(s.api.dataFigureVersion).toHaveBeenCalledOnce();
    expect(s.api.dataFigureVersion).toHaveBeenCalledWith(
      { operation: 'status', versionId: ID },
      expect.any(AbortSignal)
    );
    expect(s.render).not.toHaveBeenCalled();
  });
  it('reconciles an already completed cached draft without rendering or charging again', async () => {
    const s = setup();
    const canonical = JSON.stringify(s.spec, (_key, value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
        : value
    );
    const hash = Buffer.from(
      await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
    ).toString('hex');
    s.api.planDataFigure.mockResolvedValueOnce({ ...s.draft, status: 'completed', cached: true });
    s.api.dataFigureVersion.mockResolvedValueOnce(s.version('completed', hash, 'b'.repeat(64)));
    await s.start();
    expect(s.task.state.value.phase).toBe('completed');
    expect(s.task.state.value.preview).toBeUndefined();
    expect(s.api.dataFigureVersion).toHaveBeenCalledOnce();
    expect(s.api.dataFigureVersion).toHaveBeenCalledWith(
      { operation: 'status', versionId: ID },
      expect.any(AbortSignal)
    );
    await s.task.confirm();
    expect(s.render).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'queries before replaying an unknown complete; committed=%s',
    async (committed) => {
      const s = setup();
      let receipt: any;
      s.api.dataFigureVersion.mockImplementationOnce(async (command) => {
        receipt = command;
        throw new TypeError('response lost');
      });
      await s.start();
      await s.task.confirm();
      expect(s.task.state.value.phase).toBe('unknown');
      s.allowed(false); // Recover the accepted task even when the last credit was consumed/held.
      s.api.dataFigureVersion.mockImplementationOnce(async (command) => {
        expect(command).toEqual({ operation: 'status', versionId: ID });
        return s.version(
          committed ? 'completed' : 'awaiting_render',
          receipt.specHash,
          committed ? receipt.receiptHash : null
        );
      });
      await s.task.recover();
      expect(s.task.state.value.phase).toBe('completed');
      expect(s.render).toHaveBeenCalledOnce();
      expect(s.api.planDataFigure).toHaveBeenCalledOnce();
      expect(s.api.dataFigureVersion).toHaveBeenCalledTimes(committed ? 2 : 3);
      if (!committed) expect(s.api.dataFigureVersion.mock.calls[2][0]).toEqual(receipt);
    }
  );
  it('releases an explicitly failed render without claiming success or sending a complete', async () => {
    const s = setup();
    s.render.mockRejectedValue(new Error('glyph_not_supported'));
    await s.start();
    await s.task.confirm();
    expect(s.task.state.value.phase).toBe('failed');
    expect(s.api.dataFigureVersion.mock.calls[0][0]).toEqual({ operation: 'fail', versionId: ID });
    expect(s.task.busy.value).toBe(false);
  });
  it('cancels a running render and ignores its late result', async () => {
    const s = setup();
    let finish!: (value: unknown) => void;
    s.render.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await s.start();
    const rendering = s.task.confirm();
    await vi.waitFor(() => expect(s.render).toHaveBeenCalledOnce());
    await s.task.cancel();
    finish(s.preview);
    await rendering;
    expect(s.render.mock.calls[0][1].aborted).toBe(true);
    expect(s.task.state.value.phase).toBe('cancelled');
    expect(s.task.state.value.preview).toBeUndefined();
    expect(s.api.dataFigureVersion.mock.calls.map((c) => c[0].operation)).toEqual(['cancel']);
  });
  it('drops old account results and never settles using a new account', async () => {
    const s = setup();
    let finish!: (value: unknown) => void;
    s.api.planDataFigure.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const planning = s.start();
    s.owner('member-2');
    s.task.reset();
    finish(s.draft);
    await planning;
    expect(s.task.state.value.phase).toBe('idle');
    expect(s.task.busy.value).toBe(false);
    await s.task.confirm();
    expect(s.render).not.toHaveBeenCalled();
    expect(s.api.dataFigureVersion).not.toHaveBeenCalled();
  });
  it.each(['model', 'spec', 'version'])(
    'rejects an inconsistent %s without rendering or billing',
    async (kind) => {
      const s = setup();
      s.api.planDataFigure.mockResolvedValueOnce(
        kind === 'model'
          ? { ...s.draft, requestedModel: 'gpt-5.6-terra' }
          : kind === 'spec'
            ? { ...s.draft, spec: { ...s.spec, python: 'not executed' } }
            : { ...s.draft, versionId: 'bad' }
      );
      await s.start();
      await s.task.confirm();
      expect(s.task.state.value.phase).toBe('unknown');
      expect(s.render).not.toHaveBeenCalled();
      expect(s.api.dataFigureVersion).not.toHaveBeenCalled();
    }
  );
  it('blocks a new zero-balance task but does not erase a completed preview', async () => {
    const s = setup();
    s.allowed(false);
    await s.start();
    expect(s.api.planDataFigure).not.toHaveBeenCalled();
    s.allowed(true);
    await s.start();
    await s.task.confirm();
    s.allowed(false);
    await s.start();
    expect(s.task.state.value.phase).toBe('completed');
    expect(s.task.state.value.preview).toEqual(s.preview);
    expect(s.api.planDataFigure).toHaveBeenCalledOnce();
  });
  it('does not call a lost cancel successful until recovery confirms its terminal status', async () => {
    const s = setup();
    s.api.dataFigureVersion.mockRejectedValueOnce(new TypeError('lost'));
    await s.start();
    await s.task.cancel();
    expect(s.task.state.value.phase).toBe('unknown');
    s.api.dataFigureVersion.mockResolvedValueOnce({
      ...s.version('cancelled'),
      wallet: { bonusBalance: 1, heldBonus: 0, availableBonus: 1 },
    });
    await s.task.recover();
    expect(s.task.state.value.phase).toBe('cancelled');
    expect(s.api.dataFigureVersion.mock.calls.map((c) => c[0].operation)).toEqual([
      'cancel',
      'status',
    ]);
  });
  it('rejects an inconsistent settlement receipt while retaining the preview and original task', async () => {
    const s = setup();
    s.api.dataFigureVersion.mockImplementationOnce(async (c) =>
      s.version('completed', c.specHash, 'f'.repeat(64))
    );
    await s.start();
    await s.task.confirm();
    expect(s.task.state.value.phase).toBe('unknown');
    expect(s.task.state.value.preview).toEqual(s.preview);
    expect(s.task.locked.value).toBe(true);
    await s.start();
    expect(s.api.planDataFigure).toHaveBeenCalledOnce();
  });
  it('requires explicit recovery of an unknown task ID before remote cancellation', async () => {
    const s = setup();
    let finish!: (v: unknown) => void;
    s.api.planDataFigure.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const request = s.start();
    await s.task.cancel();
    expect(s.task.state.value.phase).toBe('unknown');
    expect(s.api.dataFigureVersion).not.toHaveBeenCalled();
    finish(s.draft);
    await request;
    expect(s.task.state.value.phase).toBe('unknown');
    await s.task.recover();
    await s.task.cancel();
    expect(s.task.state.value.phase).toBe('cancelled');
    expect(s.api.planDataFigure.mock.calls[0][0].idempotencyKey).toBe(
      s.api.planDataFigure.mock.calls[1][0].idempotencyKey
    );
  });
  it('does not accept malformed data or old renderer metadata as a billable result', async () => {
    const s = setup();
    s.render.mockResolvedValue({
      ...s.preview,
      manifest: { ...s.preview.manifest, dataset_sha256: 'd'.repeat(64) },
    });
    await s.start();
    await s.task.confirm();
    expect(s.task.state.value.phase).toBe('failed');
    expect(s.api.dataFigureVersion.mock.calls.map((c) => c[0].operation)).toEqual(['fail']);
  });
});
