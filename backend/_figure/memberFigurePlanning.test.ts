import { describe, expect, it, vi } from 'vitest';
import type { MemberRpcClient } from '../_member/memberService';
import { planMemberFigure } from './memberFigurePlanning';

const id = '22222222-2222-4222-8222-222222222222';
const token = '33333333-3333-4333-8333-333333333333';
const mapping = { category: 'col_1', value: 'col_2' };
const command = () => ({
  idempotencyKey: 'same-version',
  datasetHash: 'a'.repeat(64),
  model: 'gpt-5.6-terra',
  input: {
    templateId: 'grouped-bar',
    styleId: 'nature',
    goal: 'Compare supplied values',
    fields: [
      { id: 'col_1', alias: 'Category', type: 'categorical' },
      { id: 'col_2', alias: 'Value', type: 'continuous', unit: 'mm' },
    ],
  },
});
// In-memory RPC boundary for orchestration only. Actual SQL has separate PG tests.
function database() {
  let version: any,
    claimed = false,
    cached: any,
    terminal: string | undefined;
  const rpc = vi.fn(async (name: string, args: any) => {
    if (name === 'reserve_data_figure') {
      version ??= {
        id,
        request_hash: args.p_request_hash,
        dataset_hash: args.p_dataset_hash,
        requested_model: args.p_requested_model,
        parent_id: args.p_parent_id,
      };
      if (
        version.request_hash !== args.p_request_hash ||
        version.dataset_hash !== args.p_dataset_hash
      )
        return { data: null, error: { message: 'data_figure_idempotency_conflict' } };
      return { data: version, error: null };
    }
    if (name === 'claim_data_figure_plan') {
      const data = terminal
        ? { kind: 'terminal', status: terminal }
        : (cached ?? (claimed ? { kind: 'pending' } : { kind: 'claimed', token }));
      claimed = true;
      return { data, error: null };
    }
    if (name === 'finish_data_figure_plan') {
      cached = {
        kind: 'cached',
        mapping: args.p_mapping,
        specHash: args.p_spec_hash,
        provider: args.p_actual_provider,
        model: args.p_actual_model,
        status: 'awaiting_render',
      };
      return { data: terminal ? { kind: 'terminal', status: terminal } : cached, error: null };
    }
    if (name === 'settle_data_figure') {
      terminal ??= args.p_outcome;
      return { data: { status: terminal }, error: null };
    }
    throw new Error('unexpected RPC');
  });
  return { client: { rpc } as unknown as MemberRpcClient, rpc };
}
const provider = () =>
  vi.fn(async () => ({
    provider: 'mga',
    model: 'actual-terra',
    text: JSON.stringify({ status: 'ready', mapping }),
  }));

describe('member figure planning orchestration (mock supplier)', () => {
  it('treats reordered confirmed JSON parameter keys as the same request', async () => {
    const db = database();
    const first = {
      ...command(),
      input: {
        templateId: 'forest',
        styleId: 'nature',
        goal: 'Compare effects',
        fields: [
          { id: 'col_1', alias: 'Study', type: 'categorical' },
          ...[2, 3, 4].map((n) => ({
            id: `col_${n}`,
            alias: `Value${n}`,
            type: 'continuous',
            unit: 'OR',
          })),
        ],
        parameters: { interval: { type: 'CI', ci_level: 95, effect_type: 'OR' } },
      },
    };
    const second = {
      ...first,
      input: {
        ...first.input,
        parameters: { interval: { effect_type: 'OR', ci_level: 95, type: 'CI' } },
      },
    };
    const call = vi.fn(async () => ({
      provider: 'mga',
      model: 'actual',
      text: JSON.stringify({
        status: 'ready',
        mapping: { label: 'col_1', estimate: 'col_2', lower: 'col_3', upper: 'col_4' },
      }),
    }));
    await planMemberFigure(db.client, first, call);
    expect(await planMemberFigure(db.client, second, call)).toMatchObject({
      kind: 'draft',
      cached: true,
    });
    expect(call).toHaveBeenCalledOnce();
  });
  it('reserves, calls once, freezes the plan and recovers without another call', async () => {
    const db = database(),
      call = provider();
    const first = await planMemberFigure(db.client, command(), call);
    expect(first).toMatchObject({
      kind: 'draft',
      cached: false,
      actualModel: 'actual-terra',
      requestedModel: 'gpt-5.6-terra',
      versionId: id,
      spec: { mapping, units: { value: 'mm' } },
    });
    const secondCall = provider();
    const second = await planMemberFigure(db.client, command(), secondCall);
    expect(second).toMatchObject({
      kind: 'draft',
      cached: true,
      spec: first.kind === 'draft' ? first.spec : {},
    });
    expect(call).toHaveBeenCalledOnce();
    expect(secondCall).not.toHaveBeenCalled();
    expect(JSON.stringify(first)).not.toContain(token);
  });
  it('has one provider invocation for concurrent retries', async () => {
    const db = database(),
      call = provider();
    const results = await Promise.all([
      planMemberFigure(db.client, command(), call),
      planMemberFigure(db.client, command(), call),
    ]);
    expect(results.map((r) => r.kind).sort()).toEqual(['draft', 'pending']);
    expect(call).toHaveBeenCalledOnce();
  });
  it('sends only confirmed metadata to the supplier and persists only column IDs', async () => {
    const db = database();
    const call = vi.fn(async (request: { system: string; user: string }, model: string) => {
      expect(model).toBe('gpt-5.6-terra');
      expect(JSON.parse(request.user)).toEqual(command().input);
      expect(JSON.stringify(request)).not.toContain('a'.repeat(64));
      expect(JSON.stringify(request)).not.toContain('same-version');
      return provider()();
    });
    await planMemberFigure(db.client, command(), call);
    const [, args] = db.rpc.mock.calls.find(([name]) => name === 'finish_data_figure_plan')!;
    expect(args.p_mapping).toEqual(mapping);
    expect(JSON.stringify(args)).not.toContain('Compare supplied');
    expect(JSON.stringify(args)).not.toContain('Category');
  });
  it.each([
    { model: 'legacy-model' },
    { userId: 'forged' },
    { csv: 'private' },
    { datasetHash: 'bad' },
    { idempotencyKey: ' ' },
    { parentId: 'bad' },
    { input: { ...command().input, rawRows: [] } },
  ])('rejects unsupported input before reserving: %o', async (extra) => {
    const db = database(),
      call = provider();
    await expect(
      planMemberFigure(db.client, { ...command(), ...extra }, call)
    ).rejects.toMatchObject({ code: 'invalid_data_figure_request', status: 400 });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });
  it('binds the confirmed request so changed input cannot reuse the same task', async () => {
    const db = database(),
      call = provider();
    await planMemberFigure(db.client, command(), call);
    const changed = command();
    changed.input.goal = 'Different goal';
    await expect(planMemberFigure(db.client, changed, call)).rejects.toMatchObject({ status: 409 });
    expect(call).toHaveBeenCalledOnce();
  });
  it('releases on missing parameters and never retries that failed task', async () => {
    const db = database(),
      call = provider(),
      value = command();
    delete value.input.fields[1].unit;
    expect(await planMemberFigure(db.client, value, call)).toMatchObject({
      kind: 'needs_input',
      missing: ['fields.col_2.unit'],
    });
    expect(await planMemberFigure(db.client, value, call)).toMatchObject({
      kind: 'terminal',
      status: 'failed',
    });
    expect(call).toHaveBeenCalledOnce();
  });
  it.each([
    { provider: 'mga', text: JSON.stringify({ status: 'ready', mapping }) },
    { provider: 'unknown', model: 'actual', text: '{}' },
    { provider: 'mga', model: 'actual', text: '```python\nprint(1)\n```' },
    {
      provider: 'mga',
      model: 'actual',
      text: JSON.stringify({ status: 'ready', mapping: { csv: 'secret' } }),
    },
  ])('fails safely on supplier output: %o', async (output) => {
    const db = database(),
      call = vi.fn(async () => output);
    await expect(planMemberFigure(db.client, command(), call)).rejects.toMatchObject({
      code: 'data_figure_planning_unavailable',
    });
    expect(await planMemberFigure(db.client, command(), call)).toMatchObject({
      kind: 'terminal',
      status: 'failed',
    });
    expect(call).toHaveBeenCalledOnce();
    expect(db.rpc.mock.calls.some(([name]) => name === 'finish_data_figure_plan')).toBe(false);
  });
  it('does not cancel a possibly committed finish after a lost response; retries recover it', async () => {
    const db = database(),
      original = db.rpc.getMockImplementation()!,
      call = provider();
    db.rpc.mockImplementation(async (name, args) => {
      const result = await original(name, args);
      if (name === 'finish_data_figure_plan') throw new Error('lost response with private details');
      return result;
    });
    await expect(planMemberFigure(db.client, command(), call)).rejects.toMatchObject({
      code: 'data_figure_planning_unavailable',
    });
    expect(db.rpc.mock.calls.some(([name]) => name === 'settle_data_figure')).toBe(false);
    expect(await planMemberFigure(db.client, command(), call)).toMatchObject({
      kind: 'draft',
      cached: true,
    });
    expect(call).toHaveBeenCalledOnce();
  });
  it('keeps an uncommitted interrupted claim pending rather than re-invoking', async () => {
    const db = database(),
      original = db.rpc.getMockImplementation()!,
      call = provider();
    db.rpc.mockImplementation(async (name, args) => {
      if (name === 'finish_data_figure_plan') throw new Error('no commit');
      return original(name, args);
    });
    await expect(planMemberFigure(db.client, command(), call)).rejects.toMatchObject({
      status: 503,
    });
    expect(await planMemberFigure(db.client, command(), call)).toEqual({
      kind: 'pending',
      versionId: id,
    });
    expect(call).toHaveBeenCalledOnce();
  });
  it('uses an immutable input snapshot and discards the result if cancelled mid-call', async () => {
    const db = database(),
      value = command();
    let finish!: (v: unknown) => void, started!: () => void;
    const start = new Promise<void>((resolve) => {
      started = resolve;
    });
    const call = vi.fn(async () => {
      started();
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const work = planMemberFigure(db.client, value, call);
    await start;
    value.input.fields[1].unit = 'changed';
    await db.client.rpc('settle_data_figure', { p_outcome: 'cancelled' });
    finish(await provider()());
    expect(await work).toEqual({ kind: 'terminal', versionId: id, status: 'cancelled' });
    expect(call).toHaveBeenCalledOnce();
  });
  it('never treats corrupted cached mappings or spec hashes as an executable draft', async () => {
    const db = database(),
      original = db.rpc.getMockImplementation()!,
      call = provider();
    await planMemberFigure(db.client, command(), call);
    db.rpc.mockImplementation(async (name, args) => {
      const result = await original(name, args);
      return name === 'claim_data_figure_plan'
        ? { ...result, data: { ...result.data, specHash: 'f'.repeat(64) } }
        : result;
    });
    await expect(planMemberFigure(db.client, command(), call)).rejects.toMatchObject({
      status: 503,
    });
    expect(call).toHaveBeenCalledOnce();
  });
  it('keeps confirmed units frozen when the original caller object changes during a call', async () => {
    const db = database(),
      value = command();
    const call = vi.fn(async () => {
      value.input.fields[1].unit = 'changed';
      value.input.goal = 'changed';
      return provider()();
    });
    expect(await planMemberFigure(db.client, value, call)).toMatchObject({
      kind: 'draft',
      spec: { units: { value: 'mm' } },
    });
  });
  it('does not resurrect missing-input UI after a cancellation', async () => {
    const db = database();
    const call = vi.fn(async () => {
      await db.client.rpc('settle_data_figure', { p_outcome: 'cancelled' });
      return {
        provider: 'mga',
        model: 'actual',
        text: JSON.stringify({ status: 'needs_input', missing: ['mapping.category'] }),
      };
    });
    expect(await planMemberFigure(db.client, command(), call)).toEqual({
      kind: 'terminal',
      versionId: id,
      status: 'cancelled',
    });
  });
});
