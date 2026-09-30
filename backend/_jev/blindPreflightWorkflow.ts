import { MemberServiceError, type MemberRpcClient } from '../_member/memberService.js';
import { getConferenceBlindReviewRules } from '../../lib/review/conferenceBlindReviewRules.js';
import { createJevMemberPolicy } from './memberPolicy.js';
import { requestTypesafeBlindPreflight, type JevBlindPreflightOutput } from './blindPreflight.js';

const CONFERENCES = new Set(['ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO']);

export interface MemberBlindReviewContext {
  sourceText: string;
  conference: 'ISMRM' | 'RSNA' | 'ER' | 'ASCO' | 'ESMO';
  target: 'abstract' | 'manuscript';
}

export type MemberBlindPreflight =
  | {
      status: 'completed';
      provider: 'typesafe';
      model: string;
      flags: JevBlindPreflightOutput['flags'];
    }
  | {
      status: 'unavailable' | 'skipped';
      reason: 'jev_unavailable' | 'consent_unavailable' | 'consent_required' | 'prompt_too_large';
    };

function assertContext(value: unknown, prompt: string): MemberBlindReviewContext {
  const context = value as Partial<MemberBlindReviewContext> | null;
  const sourceText = typeof context?.sourceText === 'string' ? context.sourceText.trim() : '';
  if (
    !sourceText ||
    sourceText.length > 80_000 ||
    !prompt.includes(sourceText) ||
    typeof context?.conference !== 'string' ||
    !CONFERENCES.has(context.conference) ||
    (context.target !== 'abstract' && context.target !== 'manuscript')
  )
    throw new MemberServiceError('invalid_jev_blind_preflight_context', 400);
  return {
    sourceText,
    conference: context.conference,
    target: context.target,
  } as MemberBlindReviewContext;
}

export async function prepareMemberBlindReview(input: {
  prompt: string;
  context?: unknown;
  client: MemberRpcClient;
  maxPromptBytes: number;
  getConsent?: () => Promise<{ accepted: boolean }>;
  check?: typeof requestTypesafeBlindPreflight;
}): Promise<{ prompt: string; preflight?: MemberBlindPreflight }> {
  if (process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED !== 'true' || input.context === undefined)
    return { prompt: input.prompt };
  if (
    typeof (input.context as MemberBlindReviewContext | null)?.sourceText === 'string' &&
    (input.context as MemberBlindReviewContext).sourceText.length > 80_000
  )
    return { prompt: input.prompt, preflight: { status: 'skipped', reason: 'prompt_too_large' } };
  const context = assertContext(input.context, input.prompt);
  if (Buffer.byteLength(input.prompt, 'utf8') + 2_000 > input.maxPromptBytes)
    return { prompt: input.prompt, preflight: { status: 'skipped', reason: 'prompt_too_large' } };

  let accepted = false;
  try {
    accepted = (
      await (input.getConsent ?? (() => createJevMemberPolicy(input.client).getConsent()))()
    ).accepted;
  } catch {
    return {
      prompt: input.prompt,
      preflight: { status: 'skipped', reason: 'consent_unavailable' },
    };
  }
  if (!accepted)
    return { prompt: input.prompt, preflight: { status: 'skipped', reason: 'consent_required' } };

  try {
    const result = await (input.check ?? requestTypesafeBlindPreflight)({
      sourceText: context.sourceText,
      conference: context.conference,
      conferenceRules: getConferenceBlindReviewRules(context.conference),
      target: context.target,
    });
    const advisory = [
      'Jev preflight flags below are unverified routing hints, not findings or evidence.',
      'Independently review the complete supplied text and all seven review dimensions.',
      'Do not infer that a not_detected flag means the manuscript is accurate or compliant.',
      'Never claim external citation verification unless a separate tool supplied it.',
      `Jev advisory flags: ${JSON.stringify(result.flags)}`,
    ].join('\n');
    return {
      prompt: `${input.prompt}\n\n${advisory}`,
      preflight: {
        status: 'completed',
        provider: result.provider,
        model: result.model,
        flags: result.flags,
      },
    };
  } catch {
    return {
      prompt: input.prompt,
      preflight: { status: 'unavailable', reason: 'jev_unavailable' },
    };
  }
}
