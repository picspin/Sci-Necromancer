import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { MemberServiceError } from '../../backend/_member/memberService';

const mocks = vi.hoisted(() => ({
  assertContext: vi.fn(),
  runManagedGeneration: vi.fn(),
  callManagedProvider: vi.fn(),
  postCheck: vi.fn(),
  persistVersion: vi.fn(),
  getConsent: vi.fn(),
  prepareBlindReview: vi.fn(),
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
vi.mock('../../backend/_jev/postCheckPipeline', () => ({
  runJevPostCheckPipeline: mocks.postCheck,
}));
vi.mock('../../backend/_jev/versionStore', () => ({
  createJevVersionStore: () => ({ persistVersion: mocks.persistVersion }),
}));
vi.mock('../../backend/_jev/memberPolicy', () => ({
  createJevMemberPolicy: () => ({ getConsent: mocks.getConsent }),
}));
vi.mock('../../backend/_jev/blindPreflightWorkflow', () => ({
  prepareMemberBlindReview: mocks.prepareBlindReview,
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
    delete process.env.TYPESAFE_JEV_POST_CHECK_ENABLED;
    mocks.assertContext.mockResolvedValue(true);
    mocks.getConsent.mockResolvedValue({ accepted: true, version: 'test' });
    mocks.prepareBlindReview.mockImplementation(async ({ prompt }) => ({ prompt }));
    mocks.callManagedProvider.mockResolvedValue({
      type: 'text',
      text: '{"abstract":"Draft"}',
      model: 'glm-5.2',
    });
    mocks.postCheck.mockImplementation(async ({ draft }) => ({
      output: draft,
      version: {
        id: '550e8400-e29b-41d4-a716-446655440099',
        sourceHash: createHash('sha256').update(SOURCE).digest('hex'),
        draftText: draft.text,
        finalText: draft.text,
        draftHash: createHash('sha256').update(draft.text).digest('hex'),
        finalHash: createHash('sha256').update(draft.text).digest('hex'),
        conference: 'ISMRM',
        generationModels: ['glm-5.2'],
        generationCalls: [{ stage: 'draft', provider: 'mga', model: 'glm-5.2' }],
        initialCheck: null,
        finalCheck: null,
        status: 'review_unavailable',
      },
    }));
    mocks.persistVersion.mockImplementation(async (version) => version);
    mocks.runManagedGeneration.mockImplementation(async (_input, _member, callProvider) => {
      const output = await callProvider();
      return { output, bonusBalance: 8 };
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

  it('accepts the new Terra ID while excluding the unverified PTU deployment', async () => {
    await handler(request({ model: 'gpt-5.6-terra' }), response());
    expect(mocks.assertContext).toHaveBeenCalledWith(
      WORKFLOW_ID,
      expect.objectContaining({ model: 'gpt-5.6-terra' }),
      'generation'
    );
    vi.clearAllMocks();
    const rejected = response();
    await handler(request({ model: 'mga-gpt-5.6-terra-ptu' }), rejected);
    expect(rejected.status).toHaveBeenCalledWith(400);
    expect(mocks.runManagedGeneration).not.toHaveBeenCalled();
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

  it('keeps post-check off by default even for a Jev workflow', async () => {
    await handler(request(), response());
    expect(mocks.postCheck).not.toHaveBeenCalled();
    expect(mocks.persistVersion).not.toHaveBeenCalled();
  });

  it('persists the checked version before delivering a member generation', async () => {
    process.env.TYPESAFE_JEV_POST_CHECK_ENABLED = 'true';
    const res = response();
    await handler(request(), res);
    expect(mocks.postCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: SOURCE,
        conference: 'ISMRM',
        skipReason: undefined,
      })
    );
    expect(mocks.persistVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '550e8400-e29b-41d4-a716-446655440099',
        taskId: WORKFLOW_ID,
        operation: 'generation',
        userId: 'member-1',
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          jevReview: expect.objectContaining({ versionId: '550e8400-e29b-41d4-a716-446655440099' }),
        }),
      })
    );
  });

  it('does not send text to Jev after consent is revoked', async () => {
    process.env.TYPESAFE_JEV_POST_CHECK_ENABLED = 'true';
    mocks.getConsent.mockResolvedValue({ accepted: false, version: 'test' });
    await handler(request(), response());
    expect(mocks.postCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        skipReason: 'consent_revoked',
      })
    );
  });

  it('passes blind-review source context through the ordinary member text route', async () => {
    mocks.prepareBlindReview.mockResolvedValue({
      prompt: 'Review synthetic manuscript. Jev advisory flags: {}',
      preflight: { status: 'completed', provider: 'typesafe', model: 'jev-1.13.0', flags: {} },
    });
    const blindContext = {
      sourceText: SOURCE,
      conference: 'ISMRM',
      target: 'manuscript',
    };
    const res = response();
    await handler(
      request({
        operation: 'blind_review',
        workflowId: undefined,
        prompt: `Review synthetic manuscript. ${SOURCE}`,
        blindReviewContext: blindContext,
      }),
      res
    );

    expect(mocks.prepareBlindReview).toHaveBeenCalledWith(
      expect.objectContaining({
        context: blindContext,
        maxPromptBytes: 100_000,
      })
    );
    expect(mocks.callManagedProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Review synthetic manuscript. Jev advisory flags: {}',
      })
    );
    expect(mocks.runManagedGeneration).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          jevPreflight: expect.objectContaining({ status: 'completed', model: 'jev-1.13.0' }),
        }),
      })
    );
  });
});
