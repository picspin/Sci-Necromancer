import type { VercelRequest, VercelResponse } from '../_types/vercel.js';
import { prepareMemberApi, sendApiError } from '../_member/http.js';
import { MemberServiceError } from '../_member/memberService.js';
import {
  createAdminSupabaseClient,
  createScopedMemberRpcClient,
  requireAuthenticatedUser,
} from '../_member/supabaseServer.js';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const STATES = ['reserved', 'awaiting_render', 'completed', 'failed', 'cancelled', 'expired'];
const FORMATS = ['png', 'pdf', 'svg', 'reproducibility'];
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value: unknown) => typeof value === 'string' && HASH.test(value);
const unavailable = () => new MemberServiceError('data_figure_unavailable', 503);

// Explicit response projection: never expose user IDs, idempotency keys or new DB columns.
function versionResponse(value: unknown, userId: string, versionId: string) {
  if (
    !record(value) ||
    value.id !== versionId ||
    value.user_id !== userId ||
    typeof value.status !== 'string' ||
    !STATES.includes(value.status) ||
    (value.requested_model !== 'deepseek-v4.1-flash' &&
      value.requested_model !== 'gpt-5.6-terra') ||
    !digest(value.dataset_hash) ||
    (value.parent_id !== null &&
      (typeof value.parent_id !== 'string' || !UUID.test(value.parent_id))) ||
    (value.spec_hash !== null && !digest(value.spec_hash)) ||
    (value.receipt_hash !== null && !digest(value.receipt_hash)) ||
    (value.actual_provider !== null && value.actual_provider !== 'mga') ||
    (value.actual_model !== null &&
      (typeof value.actual_model !== 'string' ||
        !value.actual_model.trim() ||
        value.actual_model.length > 128)) ||
    !['created_at', 'lease_expires_at'].every(
      (key) => typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key]))
    ) ||
    (value.settled_at !== null &&
      (typeof value.settled_at !== 'string' || !Number.isFinite(Date.parse(value.settled_at)))) ||
    ![value.bonus_balance, value.held_bonus, value.available_bonus].every(Number.isSafeInteger) ||
    (value.held_bonus !== 0 && value.held_bonus !== 1) ||
    value.available_bonus !== (value.bonus_balance as number) - value.held_bonus ||
    (['awaiting_render', 'completed'].includes(value.status) &&
      (value.actual_provider === null ||
        value.actual_model === null ||
        value.spec_hash === null)) ||
    (value.status === 'completed' && (value.receipt_hash === null || value.settled_at === null))
  )
    throw unavailable();
  return {
    version: {
      id: value.id,
      parentId: value.parent_id,
      status: value.status,
      requestedModel: value.requested_model,
      actualProvider: value.actual_provider,
      actualModel: value.actual_model,
      datasetHash: value.dataset_hash,
      specHash: value.spec_hash,
      receiptHash: value.receipt_hash,
      createdAt: value.created_at,
      leaseExpiresAt: value.lease_expires_at,
      settledAt: value.settled_at,
    },
    wallet: {
      bonusBalance: value.bonus_balance,
      heldBonus: value.held_bonus,
      availableBonus: value.available_bonus,
    },
  };
}

export async function handleMemberFigure(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });
  if (process.env.MEMBER_DATA_FIGURES_ENABLED !== 'true')
    return response.status(404).json({ error: 'data_figures_disabled' });
  try {
    const contentType = request.headers['content-type'];
    if (
      typeof contentType !== 'string' ||
      contentType.split(';')[0].trim().toLowerCase() !== 'application/json'
    )
      throw new MemberServiceError('data_figure_json_required', 415);
    const contentLength = request.headers['content-length'];
    if (
      contentLength !== undefined &&
      (typeof contentLength !== 'string' || !/^\d+$/.test(contentLength))
    )
      throw new MemberServiceError('invalid_data_figure_request', 400);
    if (contentLength !== undefined && Number(contentLength) > 4096)
      throw new MemberServiceError('data_figure_request_too_large', 413);
    const body: unknown = request.body;
    if (!record(body)) throw new MemberServiceError('invalid_data_figure_request', 400);
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 4096)
      throw new MemberServiceError('data_figure_request_too_large', 413);
    const operation = body.operation;
    const allowed =
      operation === 'complete'
        ? ['action', 'operation', 'versionId', 'specHash', 'receiptHash']
        : operation === 'export'
          ? ['action', 'operation', 'versionId', 'format']
          : ['action', 'operation', 'versionId'];
    if (
      body.action !== 'data-figure' ||
      !['status', 'cancel', 'fail', 'complete', 'export'].includes(operation as string) ||
      typeof body.versionId !== 'string' ||
      !UUID.test(body.versionId) ||
      Object.keys(body).some((key) => !allowed.includes(key)) ||
      (operation === 'complete' && (!digest(body.specHash) || !digest(body.receiptHash))) ||
      (operation === 'export' &&
        (typeof body.format !== 'string' || !FORMATS.includes(body.format)))
    )
      throw new MemberServiceError('invalid_data_figure_request', 400);
    const versionId = body.versionId.toLowerCase();
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    const client = createScopedMemberRpcClient(admin, user.id);
    const rpc =
      operation === 'status'
        ? 'get_data_figure'
        : operation === 'export'
          ? 'authorize_data_figure_export'
          : 'settle_data_figure';
    const { data, error } = await client.rpc(
      rpc,
      operation === 'status'
        ? { p_id: versionId }
        : operation === 'export'
          ? { p_id: versionId, p_format: body.format }
          : {
              p_id: versionId,
              p_outcome:
                operation === 'complete'
                  ? 'completed'
                  : operation === 'cancel'
                    ? 'cancelled'
                    : 'failed',
              p_spec_hash: operation === 'complete' ? body.specHash : null,
              p_receipt_hash: operation === 'complete' ? body.receiptHash : null,
            }
    );
    if (error) {
      const code = error.message ?? '';
      const status = ['data_figure_not_found', 'data_figure_export_unavailable'].includes(code)
        ? 404
        : code === 'insufficient_bonus'
          ? 402
          : [
                'data_figure_not_renderable',
                'data_figure_spec_conflict',
                'data_figure_receipt_conflict',
              ].includes(code)
            ? 409
            : 503;
      throw new MemberServiceError(status === 503 ? 'data_figure_unavailable' : code, status);
    }
    if (operation === 'export') {
      if (
        !record(data) ||
        data.id !== versionId ||
        data.format !== body.format ||
        data.extra_credit_cost !== 0 ||
        !digest(data.dataset_hash) ||
        !digest(data.spec_hash) ||
        !digest(data.receipt_hash)
      )
        throw unavailable();
      return response.status(200).json({
        authorization: {
          versionId: data.id,
          datasetHash: data.dataset_hash,
          specHash: data.spec_hash,
          receiptHash: data.receipt_hash,
          format: data.format,
          extraCreditCost: 0,
        },
      });
    }
    return response.status(200).json(versionResponse(data, user.id, versionId));
  } catch (error) {
    // Never log raw Supabase errors or expose SQL details through the generic error path.
    return sendApiError(response, error instanceof MemberServiceError ? error : unavailable());
  }
}
