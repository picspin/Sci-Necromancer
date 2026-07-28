import { describe, expect, it, vi } from 'vitest';
import { runManagedGeneration } from './managedGeneration';

describe('managed generation transaction', () => {
  it('reserves and completes one bonus task around a successful provider call', async () => {
    const wallet = {
      reserveTask: vi
        .fn()
        .mockResolvedValue({ taskId: 'task-1', status: 'reserved', bonusBalance: 4 }),
      continueWorkflow: vi.fn(),
      settleTask: vi.fn().mockResolvedValue({ status: 'completed', bonusBalance: 4 }),
    };
    const provider = vi.fn().mockResolvedValue({ type: 'image', base64: 'image-data' });

    await expect(
      runManagedGeneration(
        {
          idempotencyKey: 'request-1',
          taskKind: 'image_generation',
          provider: 'gpt-image-2',
          completeWorkflow: true,
        },
        wallet,
        provider
      )
    ).resolves.toMatchObject({ output: { base64: 'image-data' }, bonusBalance: 4 });

    expect(wallet.reserveTask).toHaveBeenCalledOnce();
    expect(provider).toHaveBeenCalledOnce();
    expect(wallet.settleTask).toHaveBeenCalledWith('task-1', true, true);
  });

  it('keeps a bundled analysis workflow reserved until its generation call', async () => {
    const wallet = {
      reserveTask: vi
        .fn()
        .mockResolvedValue({ taskId: 'task-3', status: 'reserved', bonusBalance: 4 }),
      continueWorkflow: vi.fn(),
      settleTask: vi.fn().mockResolvedValue({ status: 'reserved', bonusBalance: 4 }),
    };

    await expect(
      runManagedGeneration(
        {
          idempotencyKey: 'workflow-1',
          taskKind: 'analysis_generation',
          provider: 'gemini-3.6-flash',
          completeWorkflow: false,
        },
        wallet,
        vi.fn().mockResolvedValue({ type: 'text', text: '{}' })
      )
    ).resolves.toMatchObject({ bonusBalance: 4 });
    expect(wallet.settleTask).toHaveBeenCalledWith('task-3', true, false);
  });

  it('refunds the reservation and preserves the selected provider failure', async () => {
    const wallet = {
      reserveTask: vi
        .fn()
        .mockResolvedValue({ taskId: 'task-2', status: 'reserved', bonusBalance: 4 }),
      continueWorkflow: vi.fn(),
      settleTask: vi.fn().mockResolvedValue({ status: 'refunded', bonusBalance: 5 }),
    };
    const providerError = new Error('openai_unavailable');
    const provider = vi.fn().mockRejectedValue(providerError);

    await expect(
      runManagedGeneration(
        {
          idempotencyKey: 'request-2',
          taskKind: 'image_generation',
          provider: 'gpt-image-2',
          completeWorkflow: true,
        },
        wallet,
        provider
      )
    ).rejects.toBe(providerError);

    expect(provider).toHaveBeenCalledOnce();
    expect(wallet.settleTask).toHaveBeenCalledWith('task-2', false, true);
  });

  it('refunds before settlement when an image cannot fit the Vercel response limit', async () => {
    const wallet = {
      reserveTask: vi
        .fn()
        .mockResolvedValue({ taskId: 'task-4', status: 'reserved', bonusBalance: 4 }),
      continueWorkflow: vi.fn(),
      settleTask: vi.fn().mockResolvedValue({ status: 'refunded', bonusBalance: 5 }),
    };
    await expect(
      runManagedGeneration(
        {
          idempotencyKey: 'request-4',
          taskKind: 'image_generation',
          provider: 'gpt-image-2',
          completeWorkflow: true,
        },
        wallet,
        vi.fn().mockResolvedValue({ type: 'image', base64: 'x'.repeat(3_500_001) })
      )
    ).rejects.toMatchObject({ code: 'managed_image_too_large' });
    expect(wallet.settleTask).toHaveBeenCalledWith('task-4', false, true);
  });
});
