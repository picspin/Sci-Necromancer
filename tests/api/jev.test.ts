import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestTypesafeJev: vi.fn(),
  requireUser: vi.fn(),
  policy: {
    getConsent: vi.fn(),
    setConsent: vi.fn(),
    reserve: vi.fn(),
    settle: vi.fn(),
  },
}));

vi.mock('../../backend/_jev/typesafe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../backend/_jev/typesafe')>();
  return { ...actual, requestTypesafeJev: mocks.requestTypesafeJev };
});
vi.mock('../../backend/_jev/memberPolicy', () => ({
  createJevMemberPolicy: vi.fn(() => mocks.policy),
}));
vi.mock('../../backend/_member/supabaseServer', () => ({
  createAdminSupabaseClient: vi.fn(() => ({ rpc: vi.fn() })),
  createScopedMemberRpcClient: vi.fn(() => ({ rpc: vi.fn() })),
  requireAuthenticatedUser: mocks.requireUser,
}));

import handler from '../../api/jev';

const result = {
  analysis: {
    categories: [{ name: 'Chest Imaging', type: 'main', probability: 0.95 }],
    keywords: ['CT'],
  },
  preflight: {
    isScientificSubmission: 0.95,
    hasObjective: 0.9,
    hasMethods: 0.9,
    hasResults: 0.9,
    hasConclusion: 0.9,
    needsReview: false,
  },
  provider: 'typesafe' as const,
  model: 'jev-1.13.0',
  policyVersion: 'jev-analysis-v1' as const,
};

function response() {
  const value: any = { status: vi.fn(), json: vi.fn(), send: vi.fn(), setHeader: vi.fn() };
  value.status.mockReturnValue(value);
  value.json.mockReturnValue(value);
  value.send.mockReturnValue(value);
  return value;
}

function request(body: unknown = {}, method = 'POST'): any {
  return { method, headers: { origin: 'https://www.rad-sci.org' }, body };
}

describe('/api/jev', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TYPESAFE_JEV_ENABLED = 'true';
    mocks.requireUser.mockResolvedValue({ id: 'member-1' });
    mocks.policy.getConsent.mockResolvedValue({
      accepted: true,
      version: 'typesafe-member-2026-09-21-v1',
    });
    mocks.policy.setConsent.mockResolvedValue(undefined);
    mocks.policy.reserve.mockResolvedValue({
      kind: 'reserved',
      reservationId: '550e8400-e29b-41d4-a716-446655440000',
      remaining: 29,
    });
    mocks.policy.settle.mockResolvedValue(undefined);
    mocks.requestTypesafeJev.mockResolvedValue(result);
  });

  it('remains disabled and does not authenticate when the feature flag is off', async () => {
    process.env.TYPESAFE_JEV_ENABLED = 'false';
    const res = response();
    await handler(request({ text: 'private source' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.requestTypesafeJev).not.toHaveBeenCalled();
  });

  it('returns and updates versioned member consent', async () => {
    const getResponse = response();
    await handler(request({}, 'GET'), getResponse);
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(getResponse.status).toHaveBeenCalledWith(200);
    const setResponse = response();
    await handler(request({ action: 'consent', accepted: false }), setResponse);
    expect(mocks.policy.setConsent).toHaveBeenCalledWith(false);
    expect(setResponse.status).toHaveBeenCalledWith(200);
  });

  it('uses server-owned candidate lists and settles a successful analysis', async () => {
    const res = response();
    await handler(
      request({
        action: 'analyze',
        conference: 'RSNA',
        text: 'A CT study with objective methods results and conclusion.',
        categories: [{ name: 'attacker', type: 'main' }],
        keywords: ['attacker'],
      }),
      res
    );
    const input = mocks.requestTypesafeJev.mock.calls[0][0];
    expect(input.categories.some((candidate: any) => candidate.name === 'Chest Imaging')).toBe(
      true
    );
    expect(input.categories.some((candidate: any) => candidate.name === 'attacker')).toBe(false);
    expect(input.keywords).toContain('CT');
    expect(mocks.policy.reserve).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(mocks.policy.settle).toHaveBeenCalledWith(expect.any(String), true, result);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'typesafe', cached: false, remaining: 29 })
    );
  });

  it('returns cache, pending, and rate-limit states without provider egress', async () => {
    mocks.policy.reserve.mockResolvedValueOnce({ kind: 'cached', result, remaining: 30 });
    const cached = response();
    await handler(request({ conference: 'ISMRM', text: 'cached manuscript' }), cached);
    expect(cached.status).toHaveBeenCalledWith(200);
    expect(cached.json).toHaveBeenCalledWith(expect.objectContaining({ cached: true }));
    mocks.policy.reserve.mockResolvedValueOnce({
      kind: 'pending',
      reservationId: '550e8400-e29b-41d4-a716-446655440000',
      remaining: 29,
    });
    const pending = response();
    await handler(request({ conference: 'ISMRM', text: 'pending manuscript' }), pending);
    expect(pending.status).toHaveBeenCalledWith(202);
    mocks.policy.reserve.mockResolvedValueOnce({
      kind: 'limited',
      retryAt: '2099-01-01T00:00:00Z',
      remaining: 0,
    });
    const limited = response();
    await handler(request({ conference: 'ISMRM', text: 'limited manuscript' }), limited);
    expect(limited.status).toHaveBeenCalledWith(429);
    expect(mocks.requestTypesafeJev).not.toHaveBeenCalled();
  });

  it('settles reservations as failed and returns only a sanitized provider error', async () => {
    const { TypesafeJevError } = await import('../../backend/_jev/typesafe');
    mocks.requestTypesafeJev.mockRejectedValue(new TypesafeJevError('typesafe_jev_failed', 502));
    const res = response();
    await handler(request({ conference: 'ASCO', text: 'private manuscript' }), res);
    expect(mocks.policy.settle).toHaveBeenCalledWith(expect.any(String), false);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'typesafe_jev_failed' });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('private manuscript');
  });

  it('rejects unsupported conferences before TypeSafe egress', async () => {
    const res = response();
    await handler(request({ conference: 'ESC', text: 'source' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'unsupported_jev_conference' });
    expect(mocks.requestTypesafeJev).not.toHaveBeenCalled();
  });
});
