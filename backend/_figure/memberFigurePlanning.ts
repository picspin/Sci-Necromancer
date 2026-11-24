import { createHash } from 'node:crypto';
import { MemberServiceError, type MemberRpcClient } from '../_member/memberService.js';
import {
  buildFigurePlanningRequest,
  parseFigurePlanningResponse,
  type FigurePlanningInput,
} from '../../lib/figure/figurePlanning.js';
import { FIGURE_STYLES, FIGURE_TEMPLATES } from '../../lib/figure/dataFigureTemplates.js';
import type { MemberTextModel } from '../../lib/llm/memberTextModels.js';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const unavailable = () => new MemberServiceError('data_figure_planning_unavailable', 503);
const terminalStates = ['failed', 'cancelled', 'expired', 'completed', 'awaiting_render'];
type PlanningOutcome =
  | { kind: 'pending'; versionId: string }
  | { kind: 'terminal'; versionId: string; status: string }
  | { kind: 'needs_input'; versionId: string; missing: string[] }
  | {
      kind: 'draft';
      versionId: string;
      spec: Record<string, unknown>;
      cached: boolean;
      status: 'awaiting_render' | 'completed';
      provider: 'mga';
      requestedModel: MemberTextModel;
      actualModel: string;
    };

function digest(value: unknown) {
  const canonical = JSON.stringify(value, (_key, v) =>
    record(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((key) => [key, v[key]])
        )
      : v
  );
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
async function rpc(client: MemberRpcClient, name: string, args: Record<string, unknown>) {
  let result;
  try {
    result = await client.rpc(name, args);
  } catch {
    throw unavailable();
  }
  if (result.error) {
    const code = result.error.message ?? '';
    if (name === 'finish_data_figure_plan' && code === 'invalid_data_figure_mapping')
      throw new MemberServiceError(code, 400);
    const status =
      code === 'insufficient_bonus'
        ? 402
        : code === 'data_figure_rate_limited'
          ? 429
          : ['data_figure_not_found', 'data_figure_parent_not_found'].includes(code)
            ? 404
            : [
                  'data_figure_busy',
                  'data_figure_idempotency_conflict',
                  'data_figure_request_conflict',
                  'data_figure_plan_conflict',
                ].includes(code)
              ? 409
              : 503;
    throw new MemberServiceError(
      status === 503 ? 'data_figure_planning_unavailable' : code,
      status
    );
  }
  if (!record(result.data)) throw unavailable();
  return result.data;
}

// No default provider/HTTP entry: only explicitly injected mock suppliers in this slice.
export async function planMemberFigure(
  client: MemberRpcClient,
  value: unknown,
  provide: (
    request: ReturnType<typeof buildFigurePlanningRequest>,
    model: MemberTextModel
  ) => Promise<unknown>
): Promise<PlanningOutcome> {
  if (
    !record(value) ||
    Object.keys(value).some(
      (key) => !['idempotencyKey', 'datasetHash', 'model', 'parentId', 'input'].includes(key)
    ) ||
    typeof value.idempotencyKey !== 'string' ||
    !value.idempotencyKey.trim() ||
    value.idempotencyKey.length > 128 ||
    typeof value.datasetHash !== 'string' ||
    !HASH.test(value.datasetHash) ||
    (value.model !== 'deepseek-v4.1-flash' && value.model !== 'gpt-5.6-terra') ||
    (value.parentId !== undefined &&
      (typeof value.parentId !== 'string' || !UUID.test(value.parentId)))
  )
    throw new MemberServiceError('invalid_data_figure_request', 400);
  const { idempotencyKey, datasetHash, model } = value;
  const parentId = typeof value.parentId === 'string' ? value.parentId.toLowerCase() : null;
  let request: ReturnType<typeof buildFigurePlanningRequest>;
  try {
    request = Object.freeze(buildFigurePlanningRequest(value.input));
  } catch {
    throw new MemberServiceError('invalid_data_figure_request', 400);
  }
  const input = JSON.parse(request.user) as FigurePlanningInput;
  const requestHash = digest({
    contract: 'member-data-figure-plan-v1',
    system: request.system,
    input,
    model,
    templateVersion: FIGURE_TEMPLATES[input.templateId],
    styleVersion: FIGURE_STYLES[input.styleId],
  });
  const version = await rpc(client, 'reserve_data_figure', {
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_dataset_hash: datasetHash,
    p_requested_model: model,
    p_parent_id: parentId,
  });
  if (
    typeof version.id !== 'string' ||
    !UUID.test(version.id) ||
    version.request_hash !== requestHash ||
    version.dataset_hash !== datasetHash ||
    version.requested_model !== model ||
    version.parent_id !== parentId
  )
    throw unavailable();
  const versionId = version.id;
  const claim = await rpc(client, 'claim_data_figure_plan', {
    p_id: versionId,
    p_request_hash: requestHash,
  });
  const restore = (result: Record<string, unknown>, cached: boolean): PlanningOutcome => {
    if (
      result.kind === 'terminal' &&
      typeof result.status === 'string' &&
      terminalStates.includes(result.status)
    )
      return { kind: 'terminal', versionId, status: result.status };
    if (
      result.kind !== 'cached' ||
      result.provider !== 'mga' ||
      typeof result.model !== 'string' ||
      !result.model.trim() ||
      result.model.length > 128 ||
      (result.status !== 'awaiting_render' && result.status !== 'completed')
    )
      throw unavailable();
    let parsed;
    try {
      parsed = parseFigurePlanningResponse(
        JSON.stringify({ status: 'ready', mapping: result.mapping }),
        input,
        datasetHash
      );
    } catch {
      throw unavailable();
    }
    if (parsed.status !== 'draft' || digest(parsed.spec) !== result.specHash) throw unavailable();
    return {
      kind: 'draft',
      versionId,
      spec: parsed.spec,
      cached,
      provider: 'mga',
      actualModel: result.model,
      requestedModel: model,
      status: result.status,
    };
  };
  if (claim.kind === 'pending') return { kind: 'pending', versionId };
  if (claim.kind !== 'claimed') return restore(claim, true);
  if (typeof claim.token !== 'string' || !UUID.test(claim.token)) throw unavailable();
  const release = () =>
    rpc(client, 'settle_data_figure', {
      p_id: versionId,
      p_outcome: 'failed',
      p_spec_hash: null,
      p_receipt_hash: null,
    });
  let output: Record<string, unknown>, parsed;
  try {
    const raw = await provide(request, model);
    if (
      !record(raw) ||
      raw.provider !== 'mga' ||
      typeof raw.model !== 'string' ||
      !raw.model.trim() ||
      raw.model.length > 128
    )
      throw unavailable();
    output = raw;
    parsed = parseFigurePlanningResponse(raw.text, input, datasetHash);
  } catch {
    await release().catch(() => undefined); // Lease expiry remains the durable fallback.
    throw unavailable();
  }
  if (parsed.status === 'needs_input') {
    const released = await release();
    if (released.status !== 'failed')
      return restore({ kind: 'terminal', status: released.status }, false);
    return { kind: 'needs_input', versionId, missing: parsed.missing };
  }
  // A lost finish response may already have committed. Do not cancel or re-call
  // the provider: a new request can recover cached, or wait pending until expiry.
  try {
    const result = await rpc(client, 'finish_data_figure_plan', {
      p_id: versionId,
      p_token: claim.token,
      p_mapping: parsed.spec.mapping,
      p_spec_hash: digest(parsed.spec),
      p_actual_provider: output.provider,
      p_actual_model: output.model,
    });
    return restore(result, false);
  } catch (error) {
    // Only the explicit SQL validation failure proves that this finish did not write.
    if (error instanceof MemberServiceError && error.code === 'invalid_data_figure_mapping')
      await release().catch(() => undefined);
    throw error;
  }
}
