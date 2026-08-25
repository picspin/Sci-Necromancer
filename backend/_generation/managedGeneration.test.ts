import { afterEach, describe, expect, it, vi } from 'vitest';
import { runManagedGeneration } from './managedGeneration';
import { callManagedProvider } from './providers';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

  it('charges one task when MGA falls back internally to Google image generation', async () => {
    vi.stubEnv('MGA_BASE_URL', 'https://mga.example.com/api/v2');
    vi.stubEnv('MGA_API_KEY', 'mga-test-key');
    vi.stubEnv('GOOGLE_API_KEY', 'google-test-key');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } }],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
    );
    const wallet = {
      reserveTask: vi
        .fn()
        .mockResolvedValue({ taskId: 'task-fallback', status: 'reserved', bonusBalance: 4 }),
      continueWorkflow: vi.fn(),
      settleTask: vi.fn().mockResolvedValue({ status: 'completed', bonusBalance: 4 }),
    };

    await expect(
      runManagedGeneration(
        {
          idempotencyKey: 'request-fallback',
          taskKind: 'image_generation',
          provider: 'nano-banana-pro',
          completeWorkflow: true,
        },
        wallet,
        () => callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
      )
    ).resolves.toMatchObject({ output: { provider: 'google', model: 'gemini-3.1-flash-image' } });

    expect(wallet.reserveTask).toHaveBeenCalledOnce();
    expect(wallet.settleTask).toHaveBeenCalledOnce();
    expect(wallet.settleTask).toHaveBeenCalledWith('task-fallback', true, true);
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

  it('refunds a blind review when the provider returns no valid report', async () => {
    const wallet = {
      reserveTask: vi.fn().mockResolvedValue({ taskId: 'task-5', bonusBalance: 4 }),
      continueWorkflow: vi.fn(),
      settleTask: vi.fn().mockResolvedValue({ status: 'refunded', bonusBalance: 5 }),
    };
    await expect(
      runManagedGeneration(
        {
          idempotencyKey: 'request-5',
          taskKind: 'blind_review',
          provider: 'gemini-3.6-flash',
          completeWorkflow: true,
        },
        wallet,
        vi.fn().mockResolvedValue({ type: 'text', text: '{"summary":"incomplete"}' })
      )
    ).rejects.toMatchObject({ code: 'blind_review_invalid_model_response' });
    expect(wallet.settleTask).toHaveBeenCalledWith('task-5', false, true);
  });
});
