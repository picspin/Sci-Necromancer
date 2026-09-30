import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareMemberBlindReview, type MemberBlindReviewContext } from './blindPreflightWorkflow';
import type { JevBlindPreflightOutput } from './blindPreflight';

const SOURCE = 'Synthetic manuscript: 42 adults underwent MRI; no clinical outcomes were measured.';
const CONTEXT: MemberBlindReviewContext = {
  sourceText: SOURCE,
  conference: 'ISMRM',
  target: 'manuscript',
};
const PROMPT = `Independently review the manuscript.\nMANUSCRIPT TO REVIEW:\n${SOURCE}`;
const FLAGS = {
  ethics_and_consent: 'unknown',
  de_identification: 'not_detected',
  data_integrity: 'possible',
  methodology: 'not_detected',
  citation_integrity: 'unknown',
  conference_compliance: 'possible',
  reporting_guideline: 'unknown',
} as const;
const client = { rpc: vi.fn() };
const result: JevBlindPreflightOutput = {
  provider: 'typesafe',
  model: 'jev-1.13.0',
  policyVersion: 'jev-blind-preflight-v1',
  target: 'manuscript',
  flags: FLAGS,
  needsFullReview: true,
  evidence: [],
};

afterEach(() => {
  delete process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED;
});

describe('member blind-review Jev preflight', () => {
  it('does nothing when the independent rollout flag is off', async () => {
    const check = vi.fn();
    const prepared = await prepareMemberBlindReview({
      prompt: PROMPT,
      context: CONTEXT,
      client,
      maxPromptBytes: 50_000,
      getConsent: vi.fn(),
      check,
    });
    expect(prepared).toEqual({ prompt: PROMPT });
    expect(check).not.toHaveBeenCalled();
  });

  it('passes server-owned conference rules and treats flags as advisory only', async () => {
    process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED = 'true';
    const check = vi.fn().mockResolvedValue(result);
    const prepared = await prepareMemberBlindReview({
      prompt: PROMPT,
      context: CONTEXT,
      client,
      maxPromptBytes: 50_000,
      getConsent: async () => ({ accepted: true }),
      check,
    });
    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: SOURCE,
        conference: 'ISMRM',
        target: 'manuscript',
        conferenceRules: expect.stringContaining('ISMRM platform-configured rule set'),
      })
    );
    expect(prepared.prompt).toContain(PROMPT);
    expect(prepared.prompt).toContain('unverified routing hints, not findings');
    expect(prepared.prompt).toContain('all seven review dimensions');
    expect(prepared.preflight).toMatchObject({
      status: 'completed',
      model: 'jev-1.13.0',
      flags: FLAGS,
    });
  });

  it('does not send source text after consent is declined or unavailable', async () => {
    process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED = 'true';
    const check = vi.fn();
    for (const getConsent of [
      async () => ({ accepted: false }),
      async () => {
        throw new Error('database unavailable');
      },
    ]) {
      const prepared = await prepareMemberBlindReview({
        prompt: PROMPT,
        context: CONTEXT,
        client,
        maxPromptBytes: 50_000,
        getConsent,
        check,
      });
      expect(prepared.prompt).toBe(PROMPT);
      expect(prepared.preflight?.status).toBe('skipped');
    }
    expect(check).not.toHaveBeenCalled();
  });

  it('continues the full review unchanged when TypeSafe fails', async () => {
    process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED = 'true';
    const prepared = await prepareMemberBlindReview({
      prompt: PROMPT,
      context: CONTEXT,
      client,
      maxPromptBytes: 50_000,
      getConsent: async () => ({ accepted: true }),
      check: vi.fn().mockRejectedValue(new Error('TypeSafe unavailable')),
    });
    expect(prepared).toEqual({
      prompt: PROMPT,
      preflight: { status: 'unavailable', reason: 'jev_unavailable' },
    });
  });

  it('rejects a forged source binding before Jev receives content', async () => {
    process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED = 'true';
    const check = vi.fn();
    await expect(
      prepareMemberBlindReview({
        prompt: PROMPT,
        context: { ...CONTEXT, sourceText: 'Different manuscript' },
        client,
        maxPromptBytes: 50_000,
        getConsent: vi.fn(),
        check,
      })
    ).rejects.toThrow('invalid_jev_blind_preflight_context');
    expect(check).not.toHaveBeenCalled();
  });

  it('skips Jev when an advisory suffix would exceed the full model request limit', async () => {
    process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED = 'true';
    const check = vi.fn();
    const prepared = await prepareMemberBlindReview({
      prompt: PROMPT,
      context: CONTEXT,
      client,
      maxPromptBytes: Buffer.byteLength(PROMPT, 'utf8') + 1_999,
      getConsent: vi.fn(),
      check,
    });
    expect(prepared.preflight).toEqual({ status: 'skipped', reason: 'prompt_too_large' });
    expect(check).not.toHaveBeenCalled();
  });

  it('keeps the full review available when the manuscript exceeds Jev input bounds', async () => {
    process.env.TYPESAFE_JEV_BLIND_PREFLIGHT_ENABLED = 'true';
    const check = vi.fn();
    const sourceText = 'A'.repeat(80_001);
    const prompt = `Review this manuscript: ${sourceText}`;
    const prepared = await prepareMemberBlindReview({
      prompt,
      context: { ...CONTEXT, sourceText },
      client,
      maxPromptBytes: 100_000,
      getConsent: vi.fn(),
      check,
    });
    expect(prepared).toEqual({
      prompt,
      preflight: { status: 'skipped', reason: 'prompt_too_large' },
    });
    expect(check).not.toHaveBeenCalled();
  });
});
