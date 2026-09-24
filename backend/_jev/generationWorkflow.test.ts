import { describe, expect, it, vi } from 'vitest';
import { createJevGenerationWorkflow } from './generationWorkflow';

const TASK_ID = '550e8400-e29b-41d4-a716-446655440000';
const CACHE_KEY = 'a'.repeat(64);
const CONTEXT = { sourceHash: 'b'.repeat(64), conference: 'ISMRM', model: 'glm-5.2' };

function client(result: { data: unknown; error: { message?: string } | null }) {
  return { rpc: vi.fn().mockResolvedValue(result) };
}

describe('Jev to staged generation workflow bridge', () => {
  it('opens a free analysis workflow with server-scoped RPC and returns the generation ID', async () => {
    const rpcClient = client({
      data: {
        task_id: TASK_ID,
        bonus_balance: 9,
        analysis_count: 1,
        generation_count: 0,
        deep_update_count: 0,
        call_count: 1,
      },
      error: null,
    });
    await expect(
      createJevGenerationWorkflow(rpcClient).open('analysis-1', CACHE_KEY, CONTEXT)
    ).resolves.toEqual({
      workflowId: TASK_ID,
      bonusBalance: 9,
      workflow: { analysisCount: 1, generationCount: 0, deepUpdateCount: 0, callCount: 1 },
    });
    expect(rpcClient.rpc).toHaveBeenCalledWith('jev_open_generation_workflow', {
      p_idempotency_key: 'analysis-1',
      p_cache_key: CACHE_KEY,
      p_source_hash: CONTEXT.sourceHash,
      p_conference: 'ISMRM',
      p_locked_model: 'glm-5.2',
      p_version: 'typesafe-member-2026-09-21-v1',
    });
  });

  it.each([
    ['', CACHE_KEY],
    ['x'.repeat(129), CACHE_KEY],
    ['valid', 'bad-key'],
  ])('rejects invalid input before RPC', async (idempotencyKey, cacheKey) => {
    const rpcClient = client({ data: null, error: null });
    await expect(
      createJevGenerationWorkflow(rpcClient).open(idempotencyKey, cacheKey, CONTEXT)
    ).rejects.toThrow('invalid_jev_workflow_request');
    expect(rpcClient.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['insufficient_bonus', 'insufficient_bonus'],
    ['jev_consent_required', 'jev_consent_required'],
    ['idempotency_key_conflict', 'idempotency_key_conflict'],
    ['workflow_completed', 'idempotency_key_conflict'],
  ])('maps database %s to a safe API error', async (dbCode, publicCode) => {
    const rpcClient = client({ data: null, error: { message: dbCode } });
    await expect(
      createJevGenerationWorkflow(rpcClient).open('analysis-1', CACHE_KEY, CONTEXT)
    ).rejects.toThrow(publicCode);
  });

  it('rejects malformed RPC output rather than providing an unusable workflow ID', async () => {
    const rpcClient = client({ data: { task_id: 'not-uuid', bonus_balance: 9 }, error: null });
    await expect(
      createJevGenerationWorkflow(rpcClient).open('analysis-1', CACHE_KEY, CONTEXT)
    ).rejects.toThrow('member_service_error');
  });

  it('rejects invalid source, conference and model before opening a workflow', async () => {
    const rpcClient = client({ data: null, error: null });
    for (const context of [
      { ...CONTEXT, sourceHash: 'short' },
      { ...CONTEXT, conference: 'ESC' },
      { ...CONTEXT, model: 'attacker-model' },
    ]) {
      await expect(
        createJevGenerationWorkflow(rpcClient).open('analysis-1', CACHE_KEY, context)
      ).rejects.toThrow('invalid_jev_workflow_request');
    }
    expect(rpcClient.rpc).not.toHaveBeenCalled();
  });

  it('asserts the source/conference/model context before the paid generation call', async () => {
    const rpcClient = client({ data: { jev: true }, error: null });
    await expect(
      createJevGenerationWorkflow(rpcClient).assertContext(TASK_ID, CONTEXT, 'generation')
    ).resolves.toBe(true);
    expect(rpcClient.rpc).toHaveBeenCalledWith('jev_assert_generation_context', {
      p_task_id: TASK_ID,
      p_source_hash: CONTEXT.sourceHash,
      p_conference: 'ISMRM',
      p_model: 'glm-5.2',
      p_operation: 'generation',
    });
  });

  it('maps a context mismatch to a non-billable conflict', async () => {
    const rpcClient = client({ data: null, error: { message: 'jev_generation_context_mismatch' } });
    await expect(
      createJevGenerationWorkflow(rpcClient).assertContext(TASK_ID, CONTEXT, 'generation')
    ).rejects.toThrow('jev_generation_context_mismatch');
  });
});
