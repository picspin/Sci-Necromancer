import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wallet, provider, requireUser, check, getConsent } = vi.hoisted(() => ({
  wallet: {
    reserveTask: vi.fn(),
    continueWorkflow: vi.fn(),
    settleTask: vi.fn(),
  },
  provider: vi.fn(),
  requireUser: vi.fn(),
  check: vi.fn(),
  getConsent: vi.fn(),
}));

vi.mock('../../../backend/_member/supabaseServer.js', () => ({
  createAdminSupabaseClient: vi.fn(() => ({})),
  createScopedMemberRpcClient: vi.fn(() => ({})),
  requireAuthenticatedUser: requireUser,
}));
vi.mock('../../../backend/_member/memberService.js', async () => {
  const actual = await vi.importActual<typeof import('../../../backend/_member/memberService')>(
    '../../../backend/_member/memberService'
  );
  return { ...actual, createMemberService: vi.fn(() => wallet) };
});
vi.mock('../../../backend/_generation/providers.js', () => ({
  callMGAResearchAgent: provider,
}));
vi.mock('../../../backend/_jev/blindPreflight.js', () => ({
  requestTypesafeBlindPreflight: check,
}));
vi.mock('../../../backend/_jev/memberPolicy.js', () => ({
  createJevMemberPolicy: () => ({ getConsent }),
}));

import handler from '../../../api/member/capabilities';

function responseMock() {
  const response: any = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  response.send.mockReturnValue(response);
  return response;
}

describe('member capability API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED;
    getConsent.mockResolvedValue({ accepted: true });
    check.mockResolvedValue({
      provider: 'typesafe',
      model: 'jev-1.13.0',
      flags: {
        ethics_and_consent: 'unknown',
        de_identification: 'unknown',
        data_integrity: 'unknown',
        methodology: 'unknown',
        citation_integrity: 'unknown',
        conference_compliance: 'unknown',
        reporting_guideline: 'unknown',
      },
    });
    requireUser.mockResolvedValue({ id: 'member-1' });
    wallet.reserveTask.mockResolvedValue({ taskId: 'task-1', bonusBalance: 4 });
    wallet.settleTask.mockResolvedValue({ status: 'completed', bonusBalance: 4 });
    provider.mockResolvedValue({
      type: 'text',
      text: JSON.stringify({
        recommendation: 'pass-with-caveats',
        summary: 'Related literature was found but the submitted data remain unverified.',
        findings: [],
      }),
    });
  });

  it('lists the sanitized managed catalog for an authenticated member', async () => {
    const response = responseMock();
    await handler(
      {
        method: 'GET',
        headers: { origin: 'https://www.rad-sci.org', host: 'www.rad-sci.org' },
      } as any,
      response
    );

    expect(requireUser).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(200);
    const payload = response.json.mock.calls[0][0];
    expect(payload.capabilities).toHaveLength(4);
    expect(JSON.stringify(payload)).not.toMatch(/api[_-]?key|base[_-]?url|tool[_-]?key|token/i);
  });

  it('runs one billed verification task with member-selected approved tools', async () => {
    const response = responseMock();
    await handler(
      {
        method: 'POST',
        headers: {
          origin: 'https://www.rad-sci.org',
          host: 'www.rad-sci.org',
          'idempotency-key': 'verification-1',
        },
        body: {
          capabilityId: 'mga-research-verification-agent',
          enabledCapabilityIds: ['mga-pubmed', 'mga-semantic-scholar'],
          prompt: 'Verify this abstract.',
        },
      } as any,
      response
    );

    expect(wallet.reserveTask).toHaveBeenCalledWith('verification-1', 'blind_review');
    expect(provider).toHaveBeenCalledWith({
      prompt: 'Verify this abstract.',
      enabledCapabilityIds: ['mga-pubmed', 'mga-semantic-scholar'],
    });
    expect(wallet.settleTask).toHaveBeenCalledWith('task-1', true, true);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('adds an advisory Jev prescreen to the agent path without a second credit charge', async () => {
    process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED = 'true';
    const response = responseMock();
    await handler(
      {
        method: 'POST',
        headers: {
          origin: 'https://www.rad-sci.org',
          host: 'www.rad-sci.org',
          'idempotency-key': 'verification-jev-1',
        },
        body: {
          capabilityId: 'mga-research-verification-agent',
          enabledCapabilityIds: ['mga-pubmed'],
          prompt: 'Review this synthetic manuscript. SOURCE: MRI methods.',
          blindReviewContext: {
            sourceText: 'MRI methods.',
            conference: 'ISMRM',
            target: 'manuscript',
          },
        },
      } as any,
      response
    );

    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: 'MRI methods.',
        conferenceRules: expect.any(String),
      })
    );
    expect(provider).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('unverified routing hints'),
      })
    );
    expect(wallet.reserveTask).toHaveBeenCalledOnce();
    expect(wallet.settleTask).toHaveBeenCalledOnce();
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          jevPreflight: expect.objectContaining({ status: 'completed', model: 'jev-1.13.0' }),
        }),
      })
    );
  });

  it('continues the agent review unchanged when Jev fails', async () => {
    process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED = 'true';
    check.mockRejectedValue(new Error('upstream unavailable'));
    const response = responseMock();
    await handler(
      {
        method: 'POST',
        headers: {
          origin: 'https://www.rad-sci.org',
          host: 'www.rad-sci.org',
          'idempotency-key': 'verification-jev-2',
        },
        body: {
          capabilityId: 'mga-research-verification-agent',
          enabledCapabilityIds: ['mga-pubmed'],
          prompt: 'Review this synthetic manuscript. SOURCE: MRI methods.',
          blindReviewContext: {
            sourceText: 'MRI methods.',
            conference: 'ISMRM',
            target: 'manuscript',
          },
        },
      } as any,
      response
    );
    expect(provider).toHaveBeenCalledWith({
      prompt: 'Review this synthetic manuscript. SOURCE: MRI methods.',
      enabledCapabilityIds: ['mga-pubmed'],
    });
    expect(wallet.reserveTask).toHaveBeenCalledOnce();
    expect(wallet.settleTask).toHaveBeenCalledWith('task-1', true, true);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          jevPreflight: {
            status: 'unavailable',
            reason: 'jev_unavailable',
          },
        }),
      })
    );
  });

  it('rejects arbitrary tool IDs before reserving bonus', async () => {
    const response = responseMock();
    await handler(
      {
        method: 'POST',
        headers: {
          origin: 'https://www.rad-sci.org',
          host: 'www.rad-sci.org',
          'idempotency-key': 'verification-2',
        },
        body: {
          capabilityId: 'mga-research-verification-agent',
          enabledCapabilityIds: ['websearch'],
          prompt: 'Verify this abstract.',
        },
      } as any,
      response
    );

    expect(wallet.reserveTask).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: 'invalid_capability_selection' });
  });

  it('rejects prompts that exceed the UTF-8 byte boundary before reserving bonus', async () => {
    const response = responseMock();
    await handler(
      {
        method: 'POST',
        headers: {
          origin: 'https://www.rad-sci.org',
          host: 'www.rad-sci.org',
          'idempotency-key': 'verification-3',
        },
        body: {
          capabilityId: 'mga-research-verification-agent',
          enabledCapabilityIds: ['mga-pubmed'],
          prompt: '研'.repeat(25_001),
        },
      } as any,
      response
    );

    expect(wallet.reserveTask).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('rejects mixed-type capability IDs instead of silently dropping unknown values', async () => {
    const response = responseMock();
    await handler(
      {
        method: 'POST',
        headers: {
          origin: 'https://www.rad-sci.org',
          host: 'www.rad-sci.org',
          'idempotency-key': 'verification-4',
        },
        body: {
          capabilityId: 'mga-research-verification-agent',
          enabledCapabilityIds: ['mga-pubmed', 42],
          prompt: 'Verify this abstract.',
        },
      } as any,
      response
    );

    expect(wallet.reserveTask).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });
});
