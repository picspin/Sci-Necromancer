import { createHash } from 'node:crypto';
import { MemberServiceError, type MemberRpcClient } from '../_member/memberService.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_TEXT_BYTES = 100_000;
const MAX_CHECK_BYTES = 65_536;
const MAX_MODELS = 4;
const CONFERENCES = new Set(['ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO', 'JACC']);
const STATUSES = new Set(['check_complete', 'needs_author_review', 'review_unavailable']);

export type JevVersionOperation = 'generation' | 'deep_update';
export type JevVersionStatus = 'check_complete' | 'needs_author_review' | 'review_unavailable';

export interface JevPostCheckVersion {
  id?: string;
  taskId: string;
  operation: JevVersionOperation;
  userId: string;
  sourceHash: string;
  draftText: string;
  finalText: string;
  draftHash: string;
  finalHash: string;
  conference: string | null;
  generationModels: string[];
  initialCheck: Record<string, unknown> | null;
  finalCheck: Record<string, unknown> | null;
  status: JevVersionStatus;
}

interface VersionRow {
  id: string;
  task_id: string;
  user_id: string;
  operation: JevVersionOperation;
  source_hash: string;
  draft_text: string;
  final_text: string;
  draft_hash: string;
  final_hash: string;
  conference: string | null;
  generation_models: unknown;
  initial_check: unknown;
  final_check: unknown;
  status: JevVersionStatus;
}

function bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function validCheck(value: unknown): value is Record<string, unknown> | null {
  return value === null || (typeof value === 'object' && value !== null && !Array.isArray(value));
}

function validate(input: JevPostCheckVersion): void {
  if (
    !UUID.test(input.userId) ||
    !UUID.test(input.taskId) ||
    !['generation', 'deep_update'].includes(input.operation) ||
    !SHA256.test(input.sourceHash) ||
    !input.draftText.trim() ||
    !input.finalText.trim() ||
    bytes(input.draftText) > MAX_TEXT_BYTES ||
    bytes(input.finalText) > MAX_TEXT_BYTES ||
    !SHA256.test(input.draftHash) ||
    !SHA256.test(input.finalHash) ||
    hash(input.draftText) !== input.draftHash ||
    hash(input.finalText) !== input.finalHash ||
    (input.conference !== null && !CONFERENCES.has(input.conference)) ||
    input.generationModels.length > MAX_MODELS ||
    input.generationModels.some((model) => !model.trim() || model.length > 128) ||
    !validCheck(input.initialCheck) ||
    !validCheck(input.finalCheck) ||
    (input.initialCheck !== null && bytes(JSON.stringify(input.initialCheck)) > MAX_CHECK_BYTES) ||
    (input.finalCheck !== null && bytes(JSON.stringify(input.finalCheck)) > MAX_CHECK_BYTES) ||
    !STATUSES.has(input.status)
  ) {
    throw new MemberServiceError('invalid_jev_generation_version', 400);
  }
}

function mapRow(row: VersionRow): JevPostCheckVersion {
  if (
    !UUID.test(row.id) ||
    !UUID.test(row.task_id) ||
    !UUID.test(row.user_id) ||
    !Array.isArray(row.generation_models) ||
    !row.generation_models.every((model) => typeof model === 'string') ||
    !validCheck(row.initial_check) ||
    !validCheck(row.final_check)
  ) {
    throw new MemberServiceError('member_service_error', 500);
  }
  return {
    id: row.id,
    taskId: row.task_id,
    operation: row.operation,
    userId: row.user_id,
    sourceHash: row.source_hash,
    draftText: row.draft_text,
    finalText: row.final_text,
    draftHash: row.draft_hash,
    finalHash: row.final_hash,
    conference: row.conference,
    generationModels: row.generation_models,
    initialCheck: row.initial_check,
    finalCheck: row.final_check,
    status: row.status,
  };
}

export function createJevVersionStore(client: MemberRpcClient) {
  return {
    async persistVersion(input: JevPostCheckVersion): Promise<JevPostCheckVersion> {
      validate(input);
      const result = await client.rpc<{ id: string }>('jev_persist_generation_version', {
        p_user_id: input.userId,
        p_task_id: input.taskId,
        p_operation: input.operation,
        p_source_hash: input.sourceHash,
        p_conference: input.conference,
        p_draft_text: input.draftText,
        p_final_text: input.finalText,
        p_draft_hash: input.draftHash,
        p_final_hash: input.finalHash,
        p_generation_models: input.generationModels,
        p_initial_check: input.initialCheck,
        p_final_check: input.finalCheck,
        p_status: input.status,
      });
      if (result.error) {
        const message = result.error.message ?? '';
        if (message.includes('version_exists'))
          throw new MemberServiceError('jev_generation_version_exists', 409);
        if (message.includes('workflow_not_found'))
          throw new MemberServiceError('jev_generation_workflow_not_found', 404);
        if (message.includes('invalid_jev_generation_version'))
          throw new MemberServiceError('invalid_jev_generation_version', 400);
        throw new MemberServiceError('member_service_error', 500);
      }
      if (!result.data || !UUID.test(result.data.id))
        throw new MemberServiceError('member_service_error', 500);
      return { ...input, id: result.data.id };
    },

    async listVersions(userId: string, limit = 50): Promise<JevPostCheckVersion[]> {
      if (!UUID.test(userId) || !Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new MemberServiceError('invalid_jev_generation_version_query', 400);
      const result = await client.rpc<VersionRow[]>('jev_list_generation_versions', {
        p_user_id: userId,
        p_limit: limit,
      });
      if (result.error) throw new MemberServiceError('member_service_error', 500);
      if (!Array.isArray(result.data)) throw new MemberServiceError('member_service_error', 500);
      return result.data.map(mapRow);
    },
  };
}
