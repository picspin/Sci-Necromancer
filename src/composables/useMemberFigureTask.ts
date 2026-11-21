import { computed, readonly, ref, shallowRef } from 'vue';
import {
  buildFigurePlanningRequest,
  parseFigurePlanningResponse,
} from '@/lib/figure/figurePlanning';
import {
  MemberApiError,
  type MemberFigurePlanCommand,
  type createMemberApiClient,
} from '@/src/services/memberApiClient';
import type { BrowserFigurePreview } from '@/src/services/browserFigures';

type Phase =
  | 'idle'
  | 'planning'
  | 'pending'
  | 'draft'
  | 'rendering'
  | 'settling'
  | 'releasing'
  | 'unknown'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'needs_input';
interface Wallet {
  bonusBalance: number;
  heldBonus: number;
  availableBonus: number;
}
export interface MemberFigureTaskState {
  phase: Phase;
  versionId?: string;
  spec?: Record<string, unknown>;
  preview?: BrowserFigurePreview;
  actualModel?: string;
  wallet?: Wallet;
  missing?: string[];
  error?: string;
}
type Api = Pick<ReturnType<typeof createMemberApiClient>, 'planDataFigure' | 'dataFigureVersion'>;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const terminal = new Set<Phase>(['completed', 'failed', 'cancelled', 'expired', 'needs_input']);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const canonical = (v: unknown) =>
  JSON.stringify(v, (_k, x) =>
    record(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]])
        )
      : x
  );
async function digest(v: unknown) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(v)))),
    (b) => b.toString(16).padStart(2, '0')
  ).join('');
}
const invalid = () => new MemberApiError('invalid_data_figure_response', 503);
interface Work {
  owner: string;
  command: MemberFigurePlanCommand;
  id?: string;
  spec?: Record<string, unknown>;
  specHash?: string;
  receiptHash?: string;
  actualModel?: string;
  intent: 'plan' | 'complete' | 'cancel' | 'fail';
}

// A tab-lifetime task, not a background retry queue or proof of browser rendering.
export function useMemberFigureTask(
  api: Api,
  options: {
    owner: () => string | null;
    canStart: () => boolean;
    render: (spec: Record<string, unknown>, signal: AbortSignal) => Promise<BrowserFigurePreview>;
  }
) {
  const state = shallowRef<MemberFigureTaskState>({ phase: 'idle' }),
    busy = ref(false);
  const locked = computed(() => state.value.phase !== 'idle' && !terminal.has(state.value.phase));
  let work: Work | null = null,
    epoch = 0,
    controller: AbortController | null = null;
  const patch = (value: Partial<MemberFigureTaskState>) => {
    state.value = { ...state.value, ...value };
  };
  function reset() {
    ++epoch;
    controller?.abort();
    controller = null;
    work = null;
    busy.value = false;
    state.value = { phase: 'idle' };
  }
  async function run(
    t: Work,
    phase: Phase,
    action: (current: () => boolean, signal: AbortSignal) => Promise<void>
  ) {
    if (options.owner() !== t.owner) {
      reset();
      return;
    }
    controller?.abort();
    const active = new AbortController(),
      runId = ++epoch;
    controller = active;
    busy.value = true;
    patch({ phase, error: undefined });
    const current = () => epoch === runId && work === t && options.owner() === t.owner;
    try {
      await action(current, active.signal);
    } catch (error) {
      if (current())
        patch({
          phase: 'unknown',
          error: error instanceof MemberApiError ? error.code : 'data_figure_request_unavailable',
        });
    } finally {
      if (current()) {
        busy.value = false;
        controller = null;
      } else if (epoch === runId && work === t && options.owner() !== t.owner) reset();
    }
  }
  function version(t: Work, raw: unknown) {
    if (!record(raw) || !record(raw.version) || !record(raw.wallet)) throw invalid();
    const v = raw.version,
      w = raw.wallet;
    if (
      v.id !== t.id ||
      v.datasetHash !== t.command.datasetHash ||
      v.parentId !== (t.command.parentId ?? null) ||
      v.requestedModel !== t.command.model ||
      !['reserved', 'awaiting_render', 'completed', 'failed', 'cancelled', 'expired'].includes(
        v.status as string
      ) ||
      ![w.bonusBalance, w.heldBonus, w.availableBonus].every(Number.isSafeInteger) ||
      (w.heldBonus !== 0 && w.heldBonus !== 1) ||
      w.availableBonus !== (w.bonusBalance as number) - w.heldBonus ||
      (v.specHash !== null && (typeof v.specHash !== 'string' || !HASH.test(v.specHash))) ||
      (v.receiptHash !== null &&
        (typeof v.receiptHash !== 'string' || !HASH.test(v.receiptHash))) ||
      (['awaiting_render', 'completed'].includes(v.status as string) &&
        (v.actualProvider !== 'mga' ||
          typeof v.actualModel !== 'string' ||
          !v.actualModel.trim() ||
          v.actualModel.length > 128 ||
          (t.actualModel !== undefined && v.actualModel !== t.actualModel) ||
          typeof v.specHash !== 'string' ||
          (t.specHash !== undefined && v.specHash !== t.specHash))) ||
      (v.status === 'completed' &&
        (typeof v.receiptHash !== 'string' ||
          (t.receiptHash !== undefined && v.receiptHash !== t.receiptHash)))
    )
      throw invalid();
    patch({ wallet: w as unknown as Wallet });
    if (terminal.has(v.status as Phase)) patch({ phase: v.status as Phase });
    return v.status as string;
  }
  async function release(t: Work, current: () => boolean, signal: AbortSignal) {
    const result = await api.dataFigureVersion(
      { operation: t.intent === 'cancel' ? 'cancel' : 'fail', versionId: t.id! },
      signal
    );
    if (current() && !terminal.has(version(t, result) as Phase)) throw invalid();
  }
  async function complete(t: Work, current: () => boolean, signal: AbortSignal) {
    const result = await api.dataFigureVersion(
      {
        operation: 'complete',
        versionId: t.id!,
        specHash: t.specHash!,
        receiptHash: t.receiptHash!,
      },
      signal
    );
    if (current() && !terminal.has(version(t, result) as Phase)) throw invalid();
  }
  async function plan(t: Work, current: () => boolean, signal: AbortSignal) {
    const result = await api.planDataFigure(clone(t.command), signal);
    if (!current()) return;
    if (
      !record(result) ||
      typeof result.versionId !== 'string' ||
      !UUID.test(result.versionId) ||
      (t.id && t.id !== result.versionId)
    )
      throw invalid();
    t.id = result.versionId;
    patch({ versionId: t.id });
    if (result.kind === 'pending') {
      patch({ phase: 'pending' });
      return;
    }
    if (result.kind === 'terminal') {
      const response = await api.dataFigureVersion(
        { operation: 'status', versionId: t.id },
        signal
      );
      if (current() && !terminal.has(version(t, response) as Phase)) throw invalid();
      return;
    }
    if (result.kind === 'needs_input') {
      const parsed = parseFigurePlanningResponse(
        JSON.stringify({ status: 'needs_input', missing: result.missing }),
        t.command.input,
        t.command.datasetHash
      );
      if (parsed.status !== 'needs_input') throw invalid();
      patch({ phase: 'needs_input', missing: parsed.missing });
      return;
    }
    if (
      result.kind !== 'draft' ||
      result.provider !== 'mga' ||
      result.requestedModel !== t.command.model ||
      typeof result.actualModel !== 'string' ||
      !result.actualModel.trim() ||
      result.actualModel.length > 128 ||
      typeof result.cached !== 'boolean' ||
      !['awaiting_render', 'completed'].includes(result.status as string) ||
      !record(result.spec)
    )
      throw invalid();
    const parsed = parseFigurePlanningResponse(
      JSON.stringify({ status: 'ready', mapping: result.spec.mapping }),
      t.command.input,
      t.command.datasetHash
    );
    if (parsed.status !== 'draft' || canonical(parsed.spec) !== canonical(result.spec))
      throw invalid();
    const specHash = await digest(parsed.spec);
    if (!current()) return;
    t.spec = clone(parsed.spec);
    t.specHash = specHash;
    t.actualModel = result.actualModel;
    patch({ phase: 'draft', spec: clone(t.spec), actualModel: t.actualModel });
    if (result.status === 'completed') {
      const response = await api.dataFigureVersion(
        { operation: 'status', versionId: t.id },
        signal
      );
      if (current() && version(t, response) !== 'completed') throw invalid();
    }
  }
  async function start(command: Omit<MemberFigurePlanCommand, 'idempotencyKey'>) {
    if (busy.value || locked.value || !options.canStart() || !options.owner()) return;
    try {
      if (
        !HASH.test(command.datasetHash) ||
        !['deepseek-v4.1-flash', 'gpt-5.6-terra'].includes(command.model) ||
        (command.parentId !== undefined && !UUID.test(command.parentId))
      )
        throw invalid();
      const input = JSON.parse(buildFigurePlanningRequest(command.input).user);
      const frozen = {
        datasetHash: command.datasetHash,
        model: command.model,
        input,
        ...(command.parentId !== undefined ? { parentId: command.parentId.toLowerCase() } : {}),
        idempotencyKey: crypto.randomUUID(),
      };
      work = { owner: options.owner()!, command: frozen, intent: 'plan' };
      state.value = { phase: 'idle' };
      const t = work;
      await run(t, 'planning', (current, signal) => plan(t, current, signal));
    } catch {
      patch({ error: 'invalid_data_figure_request' });
    }
  }
  async function confirm() {
    const t = work;
    if (!t?.spec || !t.id || busy.value || state.value.phase !== 'draft') return;
    await run(t, 'rendering', async (current, signal) => {
      let result: BrowserFigurePreview;
      try {
        result = await options.render(clone(t.spec!), signal);
        if (!current()) return;
        const m = result.manifest;
        if (
          typeof result.preview !== 'string' ||
          !result.preview.startsWith('iVBORw0KGgo') ||
          result.preview.length > 6 * 1024 * 1024 ||
          m.dataset_sha256 !== t.command.datasetHash ||
          !HASH.test(m.figure_spec_sha256) ||
          !HASH.test(m.preview_sha256) ||
          m.template_version !== t.spec!.template_version ||
          m.style_version !== (t.spec!.style as Record<string, unknown>).version ||
          !Number.isFinite(m.dpi) ||
          m.dpi <= 300 ||
          !Number.isSafeInteger(m.width_px) ||
          m.width_px < 3840 ||
          !Number.isSafeInteger(m.height_px) ||
          m.height_px < 1
        )
          throw invalid();
        // Renderer content hash is NOT the server's canonical frozen-spec hash.
        t.receiptHash = await digest({ versionId: t.id, specHash: t.specHash, manifest: m });
        if (!current()) return;
      } catch {
        if (!current()) return;
        t.intent = 'fail';
        patch({ phase: 'releasing', error: 'data_figure_render_failed' });
        await release(t, current, signal);
        return;
      }
      t.intent = 'complete';
      patch({ phase: 'settling', preview: result });
      await complete(t, current, signal);
    });
  }
  async function recover() {
    const t = work;
    if (!t || busy.value || !['pending', 'unknown'].includes(state.value.phase)) return;
    await run(t, t.intent === 'plan' ? 'planning' : 'settling', async (current, signal) => {
      if (t.intent === 'plan') {
        await plan(t, current, signal);
        return;
      }
      const response = await api.dataFigureVersion(
        { operation: 'status', versionId: t.id! },
        signal
      );
      if (!current()) return;
      const status = version(t, response);
      if (terminal.has(status as Phase)) return;
      if (t.intent === 'complete') {
        if (status !== 'awaiting_render') throw invalid();
        await complete(t, current, signal);
      } else await release(t, current, signal);
    });
  }
  async function cancel() {
    const t = work;
    if (!t || terminal.has(state.value.phase) || (busy.value && t.intent === 'cancel')) return;
    if (!t.id) {
      ++epoch;
      controller?.abort();
      controller = null;
      busy.value = false;
      patch({ phase: 'unknown', error: 'data_figure_recover_identifier_before_cancel' });
      return;
    }
    t.intent = 'cancel';
    await run(t, 'releasing', (current, signal) => release(t, current, signal));
  }
  return {
    state: readonly(state),
    busy: readonly(busy),
    locked,
    start,
    confirm,
    recover,
    cancel,
    reset,
  };
}
