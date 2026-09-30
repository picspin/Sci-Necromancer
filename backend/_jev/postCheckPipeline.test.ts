import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { runJevPostCheckPipeline } from './postCheckPipeline';
import type { JevPostCheckInput, JevPostCheckOutput } from './postCheck';

const SOURCE =
  'Synthetic source: 42 adults, median reconstruction time 4 minutes; no outcomes measured.';
const DRAFT = JSON.stringify({
  title: 'MRI reconstruction',
  abstract: 'In 42 adults, median reconstruction time was 4 minutes.',
  keywords: ['MRI'],
});

function hash(text: string) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function checkResult(
  input: JevPostCheckInput,
  status: JevPostCheckOutput['status']
): JevPostCheckOutput {
  return {
    version: {
      id: input.versionId,
      sourceHash: hash(input.sourceText),
      outputHash: hash(input.generatedText),
      conference: input.conference,
      policyVersion: 'jev-post-check-v1',
      generationModels: [...input.generationModels],
    },
    provider: 'typesafe',
    model: 'jev-1.13.0',
    risks: {
      factual_mismatch: status === 'needs_reasoning_review' ? 'possible' : 'not_detected',
      unsupported_addition: 'not_detected',
      conclusion_overstatement: 'not_detected',
      material_omission: 'not_detected',
    },
    axes: {
      reporting_completeness: 'sufficient',
      methods_description: 'sufficient',
      conclusion_evidence: 'sufficient',
      conference_fit: 'sufficient',
      source_fidelity: 'sufficient',
    },
    status,
    evidence: [],
  };
}

const draft = { type: 'text' as const, text: DRAFT, provider: 'mga' as const, model: 'glm-5.2' };

describe('Jev generated abstract post-check pipeline', () => {
  it('freezes a clean draft without an extra reasoning call', async () => {
    const check = vi.fn(async (input: JevPostCheckInput) => checkResult(input, 'check_complete'));
    const revise = vi.fn();
    const result = await runJevPostCheckPipeline({
      sourceText: SOURCE,
      conference: 'ISMRM',
      draft,
      check,
      revise,
    });
    expect(result.output).toBe(draft);
    expect(result.version.status).toBe('check_complete');
    expect(result.version.sourceHash).toBe(hash(SOURCE));
    expect(result.version.finalHash).toBe(hash(DRAFT));
    expect(result.version.generationModels).toEqual(['glm-5.2']);
    expect(result.version.generationCalls).toEqual([
      { stage: 'draft', provider: 'mga', model: 'glm-5.2' },
    ]);
    expect(check).toHaveBeenCalledOnce();
    expect(revise).not.toHaveBeenCalled();
  });

  it('uses at most one reasoning revision and one follow-up Jev check', async () => {
    const check = vi
      .fn()
      .mockImplementationOnce(async (input: JevPostCheckInput) =>
        checkResult(input, 'needs_reasoning_review')
      )
      .mockImplementationOnce(async (input: JevPostCheckInput) =>
        checkResult(input, 'check_complete')
      );
    const revise = vi.fn().mockResolvedValue({
      type: 'text',
      provider: 'mga',
      model: 'gpt-5.6-luna',
      text: JSON.stringify({
        title: 'Changed title that must be ignored',
        abstract:
          'In 42 adults, median reconstruction time was 4 minutes; no outcomes were measured.',
        keywords: ['Fabricated keyword'],
      }),
    });
    const result = await runJevPostCheckPipeline({
      sourceText: SOURCE,
      conference: 'ISMRM',
      draft,
      check,
      revise,
    });
    expect(revise).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledTimes(2);
    expect(result.version.status).toBe('check_complete');
    expect(result.version.generationModels).toEqual(['glm-5.2', 'gpt-5.6-luna']);
    expect(result.version.generationCalls).toEqual([
      { stage: 'draft', provider: 'mga', model: 'glm-5.2' },
      { stage: 'revision', provider: 'mga', model: 'gpt-5.6-luna' },
    ]);
    expect(JSON.parse(result.output.text)).toEqual({
      title: 'MRI reconstruction',
      abstract:
        'In 42 adults, median reconstruction time was 4 minutes; no outcomes were measured.',
      keywords: ['MRI'],
    });
    expect(result.version.draftText).toBe(DRAFT);
    expect(result.version.finalText).toBe(result.output.text);
  });

  it('keeps the deliverable and explicitly marks an unavailable Jev check', async () => {
    const check = vi.fn().mockRejectedValue(new Error('upstream unavailable'));
    const revise = vi.fn();
    const result = await runJevPostCheckPipeline({
      sourceText: SOURCE,
      conference: 'RSNA',
      draft,
      check,
      revise,
    });
    expect(result.output).toBe(draft);
    expect(result.version.status).toBe('review_unavailable');
    expect(result.version.unavailableReason).toBe('post_check_failed');
    expect(revise).not.toHaveBeenCalled();
  });

  it('does not revise uncertain but unconfirmed risks', async () => {
    const check = vi.fn(async (input: JevPostCheckInput) =>
      checkResult(input, 'needs_author_review')
    );
    const revise = vi.fn();
    const result = await runJevPostCheckPipeline({
      sourceText: SOURCE,
      conference: 'ISMRM',
      draft,
      check,
      revise,
    });
    expect(result.version.status).toBe('needs_author_review');
    expect(revise).not.toHaveBeenCalled();
  });

  it('keeps the draft for author review when no time remains for a safe correction', async () => {
    const check = vi.fn(async (input: JevPostCheckInput) =>
      checkResult(input, 'needs_reasoning_review')
    );
    const revise = vi.fn();
    const result = await runJevPostCheckPipeline({
      sourceText: SOURCE,
      conference: 'ISMRM',
      draft,
      check,
      revise,
      remainingMs: () => 34_000,
    });
    expect(result.output).toBe(draft);
    expect(result.version.status).toBe('needs_author_review');
    expect(result.version.unavailableReason).toBe('time_budget_exhausted');
    expect(revise).not.toHaveBeenCalled();
  });

  it('does not start a second Jev call without time to complete it', async () => {
    const check = vi.fn(async (input: JevPostCheckInput) =>
      checkResult(input, 'needs_reasoning_review')
    );
    const revise = vi.fn().mockResolvedValue({
      type: 'text',
      provider: 'google',
      model: 'gemini-3.6-flash',
      text: JSON.stringify({ abstract: 'In 42 adults, no outcomes were measured.' }),
    });
    const remaining = vi.fn().mockReturnValueOnce(100_000).mockReturnValue(14_000);
    const result = await runJevPostCheckPipeline({
      sourceText: SOURCE,
      conference: 'ISMRM',
      draft,
      check,
      revise,
      remainingMs: remaining,
    });
    expect(check).toHaveBeenCalledOnce();
    expect(result.version.status).toBe('review_unavailable');
    expect(result.version.unavailableReason).toBe('time_budget_exhausted');
    expect(result.version.generationCalls).toEqual([
      { stage: 'draft', provider: 'mga', model: 'glm-5.2' },
      { stage: 'revision', provider: 'google', model: 'gemini-3.6-flash' },
    ]);
  });

  it('rejects a stale check result rather than attaching it to a new version', async () => {
    const check = vi.fn(async (input: JevPostCheckInput) => ({
      ...checkResult(input, 'check_complete'),
      version: {
        ...checkResult(input, 'check_complete').version,
        id: '550e8400-e29b-41d4-a716-446655440000',
      },
    }));
    const result = await runJevPostCheckPipeline({
      sourceText: SOURCE,
      conference: 'ISMRM',
      draft,
      check,
      revise: vi.fn(),
    });
    expect(result.version.status).toBe('review_unavailable');
    expect(result.version.initialCheck).toBeNull();
  });

  it('does not accept a correction whose actual model identity is absent', async () => {
    const check = vi.fn(async (input: JevPostCheckInput) =>
      checkResult(input, 'needs_reasoning_review')
    );
    const revise = vi.fn().mockResolvedValue({ type: 'text', text: '{"abstract":"Changed"}' });
    const result = await runJevPostCheckPipeline({
      sourceText: SOURCE,
      conference: 'ISMRM',
      draft,
      check,
      revise,
    });
    expect(result.output).toBe(draft);
    expect(result.version.status).toBe('review_unavailable');
    expect(result.version.unavailableReason).toBe('missing_actual_model');
  });

  it('does not send the abstract to TypeSafe after consent revocation', async () => {
    const check = vi.fn();
    const result = await runJevPostCheckPipeline({
      sourceText: SOURCE,
      conference: 'ISMRM',
      draft,
      check,
      revise: vi.fn(),
      skipReason: 'consent_revoked',
    });
    expect(check).not.toHaveBeenCalled();
    expect(result.version.status).toBe('review_unavailable');
    expect(result.version.unavailableReason).toBe('consent_revoked');
  });
});
