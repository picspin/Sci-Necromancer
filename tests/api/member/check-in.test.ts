import { beforeEach, describe, expect, it, vi } from 'vitest';

const { member, requireUser } = vi.hoisted(() => ({
  member: {
    bootstrapVerifiedAccount: vi.fn(),
    checkIn: vi.fn(),
  },
  requireUser: vi.fn(),
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
  return { ...actual, createMemberService: vi.fn(() => member) };
});

import bootstrapHandler from '../../../api/member/bootstrap';
import checkInHandler from '../../../api/member/check-in';

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

const request = () =>
  ({
    method: 'POST',
    headers: { origin: 'https://www.rad-sci.org', host: 'www.rad-sci.org' },
    body: {},
  }) as any;

describe('mainland-safe membership rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({
      id: 'member-1',
      email: 'member@example.test',
      email_confirmed_at: '2026-08-06T00:00:00Z',
    });
    member.bootstrapVerifiedAccount.mockResolvedValue({ bonus_balance: 5, awarded: false });
    member.checkIn.mockResolvedValue({ bonusBalance: 6, awarded: true });
  });

  it('checks in a verified member without a third-party browser challenge', async () => {
    const response = responseMock();

    await checkInHandler(request(), response);

    expect(member.checkIn).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ bonusBalance: 6, awarded: true });
  });

  it('bootstraps an already verified account without Turnstile', async () => {
    const response = responseMock();

    await bootstrapHandler(request(), response);

    expect(member.bootstrapVerifiedAccount).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('rejects an unverified account before awarding a daily check-in', async () => {
    requireUser.mockResolvedValue({
      id: 'member-2',
      email: 'unverified@example.test',
      email_confirmed_at: null,
    });
    const response = responseMock();

    await checkInHandler(request(), response);

    expect(member.checkIn).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: 'verified_email_required' });
  });
});
