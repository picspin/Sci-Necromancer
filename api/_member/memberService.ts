export type ManagedTaskKind =
  | 'analysis_generation'
  | 'regeneration'
  | 'deep_update'
  | 'image_generation'
  | 'blind_review';

interface RpcResult<T> {
  data: T | null;
  error: { message?: string } | null;
}

export interface MemberRpcClient {
  rpc<T = unknown>(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult<T>>;
}

export class MemberServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
    this.name = 'MemberServiceError';
  }
}

interface MemberStatusRow {
  bonus_balance: number;
  checked_in_today: boolean;
  checkin_cycle?: number;
  last_seen_at: string | null;
  signup_bonus_claimed?: boolean;
  abstract_count?: number;
  abstract_quota?: 30 | 100 | 500;
}

interface TaskRow {
  task_id: string;
  status: 'reserved' | 'completed' | 'refunded';
  bonus_balance: number;
  charged?: boolean;
  refunded?: boolean;
  call_count?: number;
  generation_count?: number;
  deep_update_count?: number;
}

export type ManagedWorkflowOperation = 'generation' | 'regeneration' | 'deep_update';

function unwrap<T>(result: RpcResult<T>): T {
  if (result.error) {
    const message = result.error.message || 'member_service_error';
    if (message.includes('insufficient_bonus')) {
      throw new MemberServiceError('insufficient_bonus', 402);
    }
    if (message.includes('unauthenticated')) {
      throw new MemberServiceError('unauthenticated', 401);
    }
    if (message.includes('abstract_too_large')) {
      throw new MemberServiceError('abstract_too_large', 413);
    }
    for (const code of [
      'idempotency_key_conflict',
      'idempotency_key_refunded',
      'workflow_expired',
      'workflow_exhausted',
      'workflow_completed',
      'workflow_busy',
      'workflow_not_found',
      'invalid_workflow_transition',
      'workflow_call_limit',
      'workflow_generation_limit',
      'workflow_deep_update_limit',
      'abstract_quota_exceeded',
      'abstract_conflict',
    ]) {
      if (message.includes(code)) throw new MemberServiceError(code, 409);
    }
    throw new MemberServiceError('member_service_error', 500);
  }
  if (result.data === null) throw new MemberServiceError('member_service_error', 500);
  return result.data;
}

function mapTask(row: TaskRow) {
  return {
    taskId: row.task_id,
    status: row.status,
    bonusBalance: row.bonus_balance,
    charged: row.charged ?? false,
    refunded: row.refunded ?? false,
    callCount: row.call_count ?? 0,
    generationCount: row.generation_count ?? 0,
    deepUpdateCount: row.deep_update_count ?? 0,
  };
}

export function createMemberService(client: MemberRpcClient) {
  return {
    async getStatus() {
      const row = unwrap(await client.rpc<MemberStatusRow>('member_status'));
      return {
        bonusBalance: row.bonus_balance,
        checkedInToday: row.checked_in_today,
        checkinCycle: row.checkin_cycle ?? 0,
        lastSeenAt: row.last_seen_at,
        signupBonusClaimed: row.signup_bonus_claimed ?? false,
        abstractCount: row.abstract_count ?? 0,
        abstractQuota: row.abstract_quota ?? 30,
      };
    },

    async bootstrapVerifiedAccount() {
      return unwrap(
        await client.rpc<{ bonus_balance: number; awarded: boolean }>('admin_claim_signup_bonus')
      );
    },

    async checkIn() {
      const row = unwrap(
        await client.rpc<MemberStatusRow & { awarded: boolean }>('check_in_bonus')
      );
      return {
        bonusBalance: row.bonus_balance,
        checkedInToday: row.checked_in_today,
        checkinCycle: row.checkin_cycle ?? 0,
        lastSeenAt: row.last_seen_at,
        signupBonusClaimed: row.signup_bonus_claimed ?? true,
        abstractCount: row.abstract_count ?? 0,
        abstractQuota: row.abstract_quota ?? 30,
        awarded: row.awarded,
      };
    },

    async upgradeAbstractQuota(targetQuota: 100 | 500) {
      if (![100, 500].includes(targetQuota)) {
        throw new MemberServiceError('invalid_abstract_quota', 400);
      }
      const row = unwrap(
        await client.rpc<{ bonus_balance: number; abstract_quota: 100 | 500; charged: number }>(
          'upgrade_abstract_quota',
          { p_target_quota: targetQuota }
        )
      );
      return {
        bonusBalance: row.bonus_balance,
        abstractQuota: row.abstract_quota,
        charged: row.charged,
      };
    },

    async reserveTask(idempotencyKey: string, taskKind: ManagedTaskKind) {
      if (!idempotencyKey || idempotencyKey.length > 128) {
        throw new MemberServiceError('invalid_idempotency_key', 400);
      }
      return mapTask(
        unwrap(
          await client.rpc<TaskRow>('reserve_bonus_task', {
            p_idempotency_key: idempotencyKey,
            p_task_kind: taskKind,
          })
        )
      );
    },

    async continueWorkflow(taskId: string, operation: ManagedWorkflowOperation) {
      return mapTask(
        unwrap(
          await client.rpc<TaskRow>('continue_bonus_task', {
            p_task_id: taskId,
            p_operation: operation,
          })
        )
      );
    },

    async settleTask(taskId: string, success: boolean, completeWorkflow: boolean) {
      return mapTask(
        unwrap(
          await client.rpc<TaskRow>('settle_bonus_task', {
            p_task_id: taskId,
            p_success: success,
            p_complete_workflow: completeWorkflow,
          })
        )
      );
    },
  };
}
