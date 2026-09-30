import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '../_types/vercel.js';
import {
  buildDataFigureRoutingRequest,
  buildIllustrationCategoryRequest,
  buildIllustrationJournalRequest,
  buildIllustrationRetryRequest,
  buildPromptCompletenessRequest,
  DATA_CHART_TEMPLATE_IDS,
  FIGURE_ROUTING_POLICY_VERSION,
  ILLUSTRATION_CATEGORY_IDS,
  ILLUSTRATION_RETRY_CHOICES,
  JOURNAL_STYLE_IDS,
  parseDataFigureRoutingResponse,
  parseIllustrationCategoryResponse,
  parseIllustrationJournalResponse,
  parseIllustrationRetryResponse,
  parsePromptCompletenessResponse,
  requestTypesafeFigureRouting,
  type FigureRoutingDecision,
  type PromptCompletenessDecision,
} from './figureRouting.js';
import { createFigureRoutePolicy, type FigureRouteKind } from './figureRoutePolicy.js';
import { MemberServiceError } from '../_member/memberService.js';
import { TypesafeJevError } from './typesafe.js';
import { prepareMemberApi, sendApiError } from '../_member/http.js';
import {
  createAdminSupabaseClient,
  createScopedMemberRpcClient,
  requireAuthenticatedUser,
} from '../_member/supabaseServer.js';

const ROUTES = {
  'data-template': {
    flag: 'TYPESAFE_JEV_DATA_FIGURE_ROUTING_ENABLED',
    allowed: DATA_CHART_TEMPLATE_IDS,
  },
  'illustration-category': {
    flag: 'TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED',
    allowed: ILLUSTRATION_CATEGORY_IDS,
  },
  'illustration-journal': {
    flag: 'TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED',
    allowed: JOURNAL_STYLE_IDS,
  },
  'illustration-prompt': {
    flag: 'TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED',
    allowed: ['complete', 'needs_revision'] as const,
  },
  'illustration-retry': {
    flag: 'TYPESAFE_JEV_ILLUSTRATION_ROUTING_ENABLED',
    allowed: ILLUSTRATION_RETRY_CHOICES,
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function validCachedDecision(
  value: unknown,
  kind: FigureRouteKind
): value is {
  kind: FigureRouteKind;
  decision: FigureRoutingDecision<string> | PromptCompletenessDecision;
} {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['kind', 'decision']) ||
    value.kind !== kind ||
    !isRecord(value.decision)
  )
    return false;
  const decision = value.decision;
  const allowed = ROUTES[kind].allowed as readonly string[];
  if (kind === 'illustration-prompt') {
    const dimensions = ['subject', 'layout', 'relationships', 'style', 'constraints'];
    const missing = decision.missing;
    const uncertain = decision.uncertain;
    if (!Array.isArray(missing) || !Array.isArray(uncertain)) return false;
    const selected = missing.length ? 'needs_revision' : uncertain.length ? 'unknown' : 'complete';
    return (
      hasOnlyKeys(decision, [
        'selected',
        'missing',
        'uncertain',
        'needsReview',
        'policyVersion',
        'provider',
        'model',
      ]) &&
      decision.provider === 'typesafe' &&
      decision.model === 'jev-1.13.0' &&
      decision.policyVersion === FIGURE_ROUTING_POLICY_VERSION &&
      decision.needsReview === (missing.length > 0 || uncertain.length > 0) &&
      decision.selected === selected &&
      [...missing, ...uncertain].every((item) => dimensions.includes(item)) &&
      new Set([...missing, ...uncertain]).size === missing.length + uncertain.length
    );
  }
  return (
    hasOnlyKeys(decision, [
      'selected',
      'needsReview',
      'probability',
      'policyVersion',
      'provider',
      'model',
    ]) &&
    decision.provider === 'typesafe' &&
    decision.model === 'jev-1.13.0' &&
    decision.policyVersion === FIGURE_ROUTING_POLICY_VERSION &&
    typeof decision.needsReview === 'boolean' &&
    typeof decision.selected === 'string' &&
    (decision.selected === 'unknown' || allowed.includes(decision.selected)) &&
    (decision.probability === null ||
      (typeof decision.probability === 'number' &&
        Number.isFinite(decision.probability) &&
        decision.probability >= 0 &&
        decision.probability <= 1))
  );
}

export async function handleFigureRoute(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });
  const kind = request.body?.kind;
  if (typeof kind !== 'string' || !(kind in ROUTES))
    return response.status(400).json({ error: 'invalid_jev_figure_route' });
  const routeKind = kind as FigureRouteKind;
  const route = ROUTES[routeKind];
  if (process.env[route.flag] !== 'true')
    return response.status(404).json({ error: 'jev_figure_route_disabled' });

  try {
    const input = request.body?.input;
    // Every branch uses its own typed, bounded request builder; neither receives raw data rows.
    const nativeRequest =
      routeKind === 'data-template'
        ? buildDataFigureRoutingRequest(input)
        : routeKind === 'illustration-category'
          ? buildIllustrationCategoryRequest(input)
          : routeKind === 'illustration-journal'
            ? buildIllustrationJournalRequest(input)
            : routeKind === 'illustration-prompt'
              ? buildPromptCompletenessRequest(input)
              : buildIllustrationRetryRequest(input);
    if (!nativeRequest) throw new MemberServiceError('jev_figure_choice_already_set', 400);
    const key = createHash('sha256')
      .update(
        JSON.stringify({
          kind: routeKind,
          version: FIGURE_ROUTING_POLICY_VERSION,
          request: nativeRequest,
        })
      )
      .digest('hex');
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    const policy = createFigureRoutePolicy(createScopedMemberRpcClient(admin, user.id));
    const reservation = await policy.reserve(routeKind, key);
    if (reservation.kind === 'cached') {
      if (!validCachedDecision(reservation.result, routeKind))
        throw new MemberServiceError('jev_figure_policy_unavailable', 503);
      return response.status(200).json({
        ...reservation.result,
        cached: true,
        remaining: reservation.remaining,
      });
    }
    if (reservation.kind === 'pending')
      return response
        .status(202)
        .json({ error: 'jev_figure_route_pending', remaining: reservation.remaining });
    if (reservation.kind === 'limited')
      return response
        .status(429)
        .json({ error: 'jev_figure_route_limited', remaining: reservation.remaining });

    try {
      const payload = await requestTypesafeFigureRouting(nativeRequest);
      const decision =
        routeKind === 'data-template'
          ? parseDataFigureRoutingResponse(payload)
          : routeKind === 'illustration-category'
            ? parseIllustrationCategoryResponse(payload)
            : routeKind === 'illustration-journal'
              ? parseIllustrationJournalResponse(payload)
              : routeKind === 'illustration-prompt'
                ? parsePromptCompletenessResponse(payload)
                : parseIllustrationRetryResponse(payload);
      const result = { kind: routeKind, decision };
      await policy.settle(reservation.reservationId, true, result);
      return response
        .status(200)
        .json({ ...result, cached: false, remaining: reservation.remaining });
    } catch {
      await policy.settle(reservation.reservationId, false).catch(() => undefined);
      throw new MemberServiceError('jev_figure_route_unavailable', 503);
    }
  } catch (error) {
    if (error instanceof TypesafeJevError)
      return response.status(error.status).json({ error: error.code });
    return sendApiError(response, error);
  }
}
