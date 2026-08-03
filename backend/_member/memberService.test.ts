import { describe, expect, it, vi } from 'vitest';
import { createMemberService, MemberServiceError } from './memberService';

describe('member service RPC boundary', () => {
  it('returns the authenticated member wallet status', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { bonus_balance: 6, checked_in_today: true, last_seen_at: '2026-07-28T10:00:00Z' },
      error: null,
    });
    const service = createMemberService({ rpc });

    await expect(service.getStatus()).resolves.toMatchObject({
      bonusBalance: 6,
      checkedInToday: true,
    });
    expect(rpc).toHaveBeenCalledWith('member_status');
  });

  it('maps the two-credit reservation for an analysis-generation task', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        task_id: 'task-1',
        status: 'reserved',
        bonus_balance: 3,
        charged: true,
        credit_cost: 2,
      },
      error: null,
    });
    const service = createMemberService({ rpc });

    await expect(service.reserveTask('request-1', 'analysis_generation')).resolves.toMatchObject({
      taskId: 'task-1',
      status: 'reserved',
      bonusBalance: 3,
      charged: true,
      creditCost: 2,
    });
    expect(rpc).toHaveBeenCalledWith('reserve_bonus_task', {
      p_idempotency_key: 'request-1',
      p_task_kind: 'analysis_generation',
    });
  });

  it('maps insufficient balance to a stable public error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'insufficient_bonus' },
    });
    const service = createMemberService({ rpc });

    await expect(service.reserveTask('request-2', 'image_generation')).rejects.toEqual(
      new MemberServiceError('insufficient_bonus', 402)
    );
  });

  it('continues a server-issued workflow task by a monotonic operation', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { task_id: 'task-1', status: 'reserved', bonus_balance: 4, charged: false },
      error: null,
    });
    const service = createMemberService({ rpc });

    await service.continueWorkflow('task-1', 'generation');
    expect(rpc).toHaveBeenCalledWith('continue_bonus_task', {
      p_task_id: 'task-1',
      p_operation: 'generation',
    });
  });

  it.each([
    'idempotency_key_conflict',
    'idempotency_key_refunded',
    'workflow_expired',
    'workflow_exhausted',
  ])('rejects an unsafe reused workflow key: %s', async (code) => {
    const service = createMemberService({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: code } }),
    });
    await expect(service.reserveTask('reused-key', 'analysis_generation')).rejects.toEqual(
      new MemberServiceError(code, 409)
    );
  });

  it('settles provider failures as refunds through the same idempotency key', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { task_id: 'task-2', status: 'refunded', bonus_balance: 5, refunded: true },
      error: null,
    });
    const service = createMemberService({ rpc });

    await expect(service.settleTask('task-2', false, true)).resolves.toMatchObject({
      status: 'refunded',
      bonusBalance: 5,
    });
    expect(rpc).toHaveBeenCalledWith('settle_bonus_task', {
      p_task_id: 'task-2',
      p_success: false,
      p_complete_workflow: true,
    });
  });
});
