import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { MemberServiceError } from '../../backend/_member/memberService';

const mocks = vi.hoisted(() => ({
  assertContext: vi.fn(),
  runManagedGeneration: vi.fn(),
  callManagedProvider: vi.fn(),
}));

vi.mock('../../backend/_jev/generationWorkflow', () => ({
  createJevGenerationWorkflow: () => ({ assertContext: mocks.assertContext }),
}));
vi.mock('../../backend/_generation/managedGeneration', () => ({
  runManagedGeneration: mocks.runManagedGeneration,
}));
vi.mock('../../backend/_generation/providers', () => ({
  callManagedProvider: mocks.callManagedProvider,
}));
vi.mock('../../backend/_member/supabaseServer', () => ({
  createAdminSupabaseClient: () => ({}),
  createScopedMemberRpcClient: () => ({ rpc: vi.fn() }),
  requireAuthenticatedUser: async () => ({ id: 'member-1' }),
}));
vi.mock('../../backend/_member/http', () => ({
  prepareMemberApi: () => true,
  verifyTurnstile: vi.fn(),
  sendApiError: (response: any, error: MemberServiceError) =>
    response.status(error.status || 500).json({ error: error.code || 'member_service_error' }),
}));

import handler from '../../api/generate';

const WORKFLOW_ID = '550e8400-e29b-41d4-a716-446655440000';
const SOURCE = 'A synthetic study of MRI reconstruction.';

function response() {
  const value: any = { status: vi.fn(), json: vi.fn(), send: vi.fn(), setHeader: vi.fn() };
  value.status.mockReturnValue(value);
  value.json.mockReturnValue(value);
  return value;
}

function request(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'POST',
    headers: { 'idempotency-key': 'generation-1' },
    body: {
      provider: 'gemini-3.6-flash',
      model: 'glm-5.2',
      operation: 'generation',
      workflowId: WORKFLOW_ID,
      prompt: 'Polish the scientific abstract.',
      sourceText: SOURCE,
      conference: 'ISMRM',
      ...overrides,
    },
  };
}

describe('Jev generation provenance boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertContext.mockResolvedValue(true);
    mocks.callManagedProvider.mockResolvedValue({ type: 'text', text: '{"abstract":"Draft"}' });
    mocks.runManagedGeneration.mockImplementation(async (_input, _member, callProvider) => {
      await callProvider();
      return { output: { type: 'text', text: '{"abstract":"Draft"}' }, bonusBalance: 8 };
    });
  });

  it('checks source hash, conference and requested model before any paid provider call', async () => {
    const res = response();
    await handler(request(), res);
    expect(mocks.assertContext).toHaveBeenCalledWith(
      WORKFLOW_ID,
      {
        sourceHash: createHash('sha256').update(SOURCE, 'utf8').digest('hex'),
        conference: 'ISMRM',
        model: 'glm-5.2',
      },
      'generation'
    );
    expect(mocks.runManagedGeneration).toHaveBeenCalledOnce();
  });

  it('rejects a provenance mismatch without reserving credit or calling the provider', async () => {
    mocks.assertContext.mockRejectedValue(
      new MemberServiceError('jev_generation_context_mismatch', 409)
    );
    const res = response();
    await handler(request({ sourceText: 'Unrelated paper' }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.runManagedGeneration).not.toHaveBeenCalled();
    expect(mocks.callManagedProvider).not.toHaveBeenCalled();
  });

  it('supplies the bound source to deep-update prompts that only contain the draft', async () => {
    const res = response();
    await handler(request({ operation: 'deep_update', model: 'gpt-5.6-luna' }), res);
    expect(mocks.assertContext).toHaveBeenCalledWith(
      WORKFLOW_ID,
      expect.objectContaining({ model: 'gpt-5.6-luna' }),
      'deep_update'
    );
    expect(mocks.callManagedProvider).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining(SOURCE) })
    );
  });

  it('does not alter a legacy workflow prompt', async () => {
    mocks.assertContext.mockResolvedValue(false);
    const res = response();
    await handler(request(), res);
    expect(mocks.callManagedProvider).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Polish the scientific abstract.' })
    );
  });
});
