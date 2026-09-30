import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DATA_CHART_TEMPLATE_IDS,
  ILLUSTRATION_CATEGORY_IDS,
  ILLUSTRATION_RETRY_CHOICES,
  JOURNAL_STYLE_IDS,
} from '../../../backend/_jev/figureRouting';

const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  settle: vi.fn(),
  requestJev: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock('../../../backend/_member/supabaseServer', () => ({
  createAdminSupabaseClient: () => ({}),
  createScopedMemberRpcClient: () => ({ rpc: vi.fn() }),
  requireAuthenticatedUser: mocks.requireUser,
}));
vi.mock('../../../backend/_jev/figureRoutePolicy', () => ({
  createFigureRoutePolicy: () => ({ reserve: mocks.reserve, settle: mocks.settle }),
}));
vi.mock('../../../backend/_jev/figureRouting', async (original) => {
  const actual = await original<typeof import('../../../backend/_jev/figureRouting')>();
  return { ...actual, requestTypesafeFigureRouting: mocks.requestJev };
});
vi.mock('../../../backend/_member/http', () => ({
  prepareMemberApi: () => true,
  sendApiError: (response: any, error: any) =>
    response.status(error.status ?? 500).json({ error: error.code ?? 'internal_error' }),
}));

import { handleFigureRoute as handler } from '../../../backend/_jev/figureRouteHandler';
import jevHandler from '../../../api/jev';

const ID = '550e8400-e29b-41d4-a716-446655440000';
function response() {
  const value: any = { status: vi.fn(), json: vi.fn(), send: vi.fn(), setHeader: vi.fn() };
  value.status.mockReturnValue(value);
  value.json.mockReturnValue(value);
  value.send.mockReturnValue(value);
  return value;
}
function request(kind: string, input: unknown): any {
  return { method: 'POST', headers: {}, body: { kind, input } };
}
function choice(allowed: readonly string[], selected: string) {
  const remainder = 0.08 / allowed.length;
  return {
    model: 'jev-1.13.0',
    answers: {
      [allowed === ILLUSTRATION_RETRY_CHOICES
        ? 'retry_advice'
        : selected === 'radiology'
          ? 'journal_style'
          : selected === 'clinical-workflow'
            ? 'illustration_category'
            : 'chart_template']: {
        type: 'choice',
        choice: selected,
        confidence: 0.9,
        probabilities: Object.fromEntries([
          ...allowed.map((id) => [id, id === selected ? 0.92 : remainder]),
          ['unknown', remainder],
        ]),
      },
    },
  };
}

describe('member figure-routing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TYPESAFE_JEV_DATA_FIGURE_ROUTING_ENABLED;
    delete process.env.TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED;
    mocks.requireUser.mockResolvedValue({ id: 'member-1' });
    mocks.reserve.mockResolvedValue({ kind: 'reserved', reservationId: ID, remaining: 29 });
    mocks.settle.mockResolvedValue(undefined);
  });

  it('keeps both routes disabled without auth or an external call', async () => {
    const res = response();
    await handler(request('data-template', {}), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.requestJev).not.toHaveBeenCalled();
  });

  it('dispatches figure routing through the existing Jev function independently of analysis flag', async () => {
    delete process.env.TYPESAFE_JEV_ENABLED;
    process.env.TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED = 'true';
    mocks.requestJev.mockResolvedValue(choice(ILLUSTRATION_CATEGORY_IDS, 'clinical-workflow'));
    const res = response();
    await jevHandler(
      {
        ...request('illustration-category', { researchIntent: 'Synthetic workflow' }),
        body: {
          action: 'figure-route',
          kind: 'illustration-category',
          input: { researchIntent: 'Synthetic workflow' },
        },
      },
      res
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.requestJev).toHaveBeenCalledOnce();
  });

  it('sends only bounded data metadata, and returns a recommendation without billing', async () => {
    process.env.TYPESAFE_JEV_DATA_FIGURE_ROUTING_ENABLED = 'true';
    mocks.requestJev.mockResolvedValue(choice(DATA_CHART_TEMPLATE_IDS, 'multi-panel-trend'));
    const res = response();
    await handler(
      request('data-template', {
        fields: [
          { alias: 'time', type: 'date' },
          { alias: 'response', type: 'proportion' },
        ],
        goal: 'Show response over time',
      }),
      res
    );
    expect(mocks.reserve).toHaveBeenCalledWith(
      'data-template',
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
    expect(mocks.requestJev).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          dataMetadata: expect.objectContaining({ goal: 'Show response over time' }),
        }),
      })
    );
    expect(mocks.settle).toHaveBeenCalledWith(
      ID,
      true,
      expect.objectContaining({
        kind: 'data-template',
        decision: expect.objectContaining({ selected: 'multi-panel-trend' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ cached: false, remaining: 29 })
    );
  });

  it('rejects raw patient rows before reservation or Jev egress', async () => {
    process.env.TYPESAFE_JEV_DATA_FIGURE_ROUTING_ENABLED = 'true';
    const res = response();
    await handler(
      request('data-template', {
        fields: [{ alias: 'group', type: 'categorical' }],
        goal: 'Group counts',
        rows: [{ patient_id: 'P1' }],
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.requestJev).not.toHaveBeenCalled();
  });

  it('keeps category and journal as two separate dependent illustration decisions', async () => {
    process.env.TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED = 'true';
    mocks.requestJev
      .mockResolvedValueOnce(choice(ILLUSTRATION_CATEGORY_IDS, 'clinical-workflow'))
      .mockResolvedValueOnce(choice(JOURNAL_STYLE_IDS, 'radiology'));
    const categoryRes = response();
    await handler(
      request('illustration-category', {
        researchIntent: 'Show the imaging triage workflow.',
      }),
      categoryRes
    );
    expect(categoryRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({ selected: 'clinical-workflow' }),
      })
    );
    const journalRes = response();
    await handler(
      request('illustration-journal', {
        researchIntent: 'Show the imaging triage workflow.',
        category: 'clinical-workflow',
      }),
      journalRes
    );
    expect(mocks.requestJev.mock.calls[1][0].state.confirmedCategory).toBe('clinical-workflow');
    expect(journalRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({ selected: 'radiology' }),
      })
    );
  });

  it('returns five typed prompt checks without generating or charging an image', async () => {
    process.env.TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED = 'true';
    mocks.requestJev.mockResolvedValue({
      model: 'jev-1.13.0',
      answers: {
        missing_subject: { type: 'noul', noul: 0.04 },
        missing_layout: { type: 'noul', noul: 0.9 },
        missing_relationships: { type: 'noul', noul: 0.4 },
        missing_style: { type: 'noul', noul: 0.02 },
        missing_constraints: { type: 'noul', noul: 0.1 },
      },
    });
    const res = response();
    await handler(
      request('illustration-prompt', {
        prompt: 'A clinical workflow with two phases',
        category: 'clinical-workflow',
      }),
      res
    );
    expect(mocks.requestJev).toHaveBeenCalledWith(
      expect.objectContaining({
        questions: expect.objectContaining({
          missing_layout: expect.objectContaining({ type: 'noul' }),
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({
          selected: 'needs_revision',
          missing: ['layout'],
          uncertain: ['relationships'],
        }),
      })
    );
  });

  it('reuses only a valid scoped prompt-check cache entry', async () => {
    process.env.TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED = 'true';
    const input = { prompt: 'Synthetic clinical workflow', category: 'clinical-workflow' };
    const cached = {
      kind: 'illustration-prompt',
      decision: {
        selected: 'complete',
        missing: [],
        uncertain: [],
        needsReview: false,
        policyVersion: 'jev-figure-routing-v1',
        provider: 'typesafe',
        model: 'jev-1.13.0',
      },
    };
    mocks.reserve
      .mockResolvedValueOnce({ kind: 'cached', result: cached, remaining: 27 })
      .mockResolvedValueOnce({
        kind: 'cached',
        result: {
          ...cached,
          decision: { ...cached.decision, sourceText: 'must not leave the cache' },
        },
        remaining: 27,
      });
    const valid = response();
    await handler(request('illustration-prompt', input), valid);
    expect(valid.status).toHaveBeenCalledWith(200);
    expect(mocks.requestJev).not.toHaveBeenCalled();
    const invalid = response();
    await handler(request('illustration-prompt', input), invalid);
    expect(invalid.status).toHaveBeenCalledWith(503);
  });

  it('accepts only the known empty-image failure for optional retry advice', async () => {
    process.env.TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED = 'true';
    const input = {
      prompt: 'Synthetic clinical workflow schematic',
      category: 'clinical-workflow',
      requestedModel: 'gemini-3.1-flash-image',
      errorCode: 'managed_provider_empty_output',
    };
    const invalid = response();
    await handler(
      request('illustration-retry', {
        ...input,
        errorCode: 'insufficient_bonus',
      }),
      invalid
    );
    expect(invalid.status).toHaveBeenCalledWith(400);
    expect(mocks.reserve).not.toHaveBeenCalled();
    mocks.requestJev.mockResolvedValue(choice(ILLUSTRATION_RETRY_CHOICES, 'revise_prompt'));
    const valid = response();
    await handler(request('illustration-retry', input), valid);
    expect(valid.json).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({ selected: 'revise_prompt' }),
      })
    );
    expect(mocks.settle).toHaveBeenCalledWith(
      ID,
      true,
      expect.objectContaining({
        kind: 'illustration-retry',
      })
    );
  });

  it('refunds the free routing reservation on an upstream error without switching providers', async () => {
    process.env.TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED = 'true';
    mocks.requestJev.mockRejectedValue(new Error('TypeSafe unavailable'));
    const res = response();
    await handler(
      request('illustration-category', { researchIntent: 'Synthetic study workflow' }),
      res
    );
    expect(mocks.settle).toHaveBeenCalledWith(ID, false);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'jev_figure_route_unavailable' });
  });
});
