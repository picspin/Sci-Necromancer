import { MemberServiceError, type MemberRpcClient } from '../_member/memberService.js';
import { JEV_CONSENT_VERSION } from './memberPolicy.js';

interface WorkflowRow {
  task_id: string;
  bonus_balance: number;
  analysis_count: number;
  generation_count: number;
  deep_update_count: number;
  call_count: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const CONFERENCES = new Set(['ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO', 'JACC']);
const MODELS = new Set(['glm-5.2', 'gpt-5.6-luna']);

export interface JevGenerationContext {
  sourceHash: string;
  conference: string;
  model: string;
}

export function createJevGenerationWorkflow(client: MemberRpcClient) {
  return {
    async open(idempotencyKey: string, cacheKey: string, context: JevGenerationContext) {
      if (
        !idempotencyKey ||
        idempotencyKey.length > 128 ||
        !SHA256.test(cacheKey) ||
        !SHA256.test(context.sourceHash) ||
        !CONFERENCES.has(context.conference) ||
        !MODELS.has(context.model)
      ) {
        throw new MemberServiceError('invalid_jev_workflow_request', 400);
      }
      const result = await client.rpc<WorkflowRow>('jev_open_generation_workflow', {
        p_idempotency_key: idempotencyKey,
        p_cache_key: cacheKey,
        p_source_hash: context.sourceHash,
        p_conference: context.conference,
        p_locked_model: context.model,
        p_version: JEV_CONSENT_VERSION,
      });
      if (result.error) {
        const message = result.error.message || '';
        if (message.includes('insufficient_bonus'))
          throw new MemberServiceError('insufficient_bonus', 402);
        if (message.includes('jev_consent_required'))
          throw new MemberServiceError('jev_consent_required', 403);
        if (message.includes('idempotency_key_conflict') || message.includes('workflow_completed'))
          throw new MemberServiceError('idempotency_key_conflict', 409);
        if (message.includes('invalid_jev_workflow_request'))
          throw new MemberServiceError('invalid_jev_workflow_request', 400);
        throw new MemberServiceError('member_service_error', 500);
      }
      const row = result.data;
      if (
        !row ||
        typeof row.task_id !== 'string' ||
        !UUID.test(row.task_id) ||
        !Number.isInteger(row.bonus_balance) ||
        row.bonus_balance <= 0 ||
        !Number.isInteger(row.analysis_count) ||
        row.analysis_count < 1 ||
        !Number.isInteger(row.call_count) ||
        row.call_count < 1 ||
        !Number.isInteger(row.generation_count) ||
        row.generation_count < 0 ||
        !Number.isInteger(row.deep_update_count) ||
        row.deep_update_count < 0
      ) {
        throw new MemberServiceError('member_service_error', 500);
      }
      return {
        workflowId: row.task_id,
        bonusBalance: row.bonus_balance,
        workflow: {
          analysisCount: row.analysis_count,
          generationCount: row.generation_count,
          deepUpdateCount: row.deep_update_count,
          callCount: row.call_count,
        },
      };
    },
    async assertContext(
      workflowId: string,
      context: JevGenerationContext,
      operation: 'analysis' | 'generation' | 'regeneration' | 'deep_update'
    ): Promise<boolean> {
      if (!UUID.test(workflowId)) throw new MemberServiceError('invalid_generation_request', 400);
      const result = await client.rpc<{ jev: boolean }>('jev_assert_generation_context', {
        p_task_id: workflowId,
        p_source_hash: context.sourceHash,
        p_conference: context.conference,
        p_model: context.model,
        p_operation: operation,
      });
      if (result.error) {
        const message = result.error.message || '';
        if (message.includes('jev_generation_context_mismatch'))
          throw new MemberServiceError('jev_generation_context_mismatch', 409);
        if (message.includes('workflow_not_found'))
          throw new MemberServiceError('workflow_not_found', 409);
        throw new MemberServiceError('member_service_error', 500);
      }
      if (typeof result.data?.jev !== 'boolean')
        throw new MemberServiceError('member_service_error', 500);
      return result.data.jev;
    },
  };
}
