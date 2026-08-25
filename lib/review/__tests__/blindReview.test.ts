import { describe, expect, it } from 'vitest';
import {
  assertBlindReviewAssessment,
  buildBlindReviewPrompt,
  extractCitationCandidates,
  mergeBlindReviewReport,
} from '../blindReview';
import type { BlindReviewModelAssessment, ExternalVerificationResult } from '@/types';

describe('blind review public contract', () => {
  it('rejects malformed findings instead of trusting model-shaped JSON', () => {
    expect(() =>
      assertBlindReviewAssessment({
        recommendation: 'minor-revision',
        summary: 'Review needed',
        findings: [{ id: 'x', dimension: 'invented-dimension', severity: 'critical' }],
      })
    ).toThrow('blind_review.invalid_model_report');
  });

  it('keeps unavailable external reviewers explicit instead of treating them as verified', () => {
    const assessment: BlindReviewModelAssessment = {
      recommendation: 'major-revision',
      summary: 'The sample-size claim needs source confirmation.',
      findings: [
        {
          id: 'finding-1',
          dimension: 'data-integrity',
          severity: 'high',
          claim: 'The abstract reports 120 participants.',
          evidence: 'The supplied source does not contain 120.',
          recommendation: 'Replace the number with an explicit placeholder.',
          verificationStatus: 'unsupported',
        },
      ],
      aiAssistance: {
        disclosureVersion: 'jama-2026-v1',
        platform: {
          name: 'Sci-Necromancer',
          project: 'picspin/Sci-Necromancer',
          url: 'https://www.rad-sci.org',
        },
        generatedAt: '2026-07-28T00:00:00.000Z',
        provider: 'mga',
        model: 'glm-5',
        modelType: 'research-agent',
        mode: 'standard',
        operations: ['read-only literature verification'],
        boundaries: ['source data', 'factual claims', 'references'],
        methodsDisclosureRequired: true,
        authorVerificationRequired: true,
      },
    };
    const external: ExternalVerificationResult[] = [
      {
        reviewer: 'citecheck',
        status: 'unavailable',
        checkedAt: '2026-07-28T00:00:00.000Z',
        summary: 'Backend MCP is not configured.',
        records: [],
      },
    ];

    const report = mergeBlindReviewReport(assessment, external, {
      conference: 'RSNA',
      reviewedAt: '2026-07-28T00:00:00.000Z',
    });

    expect(report.externalVerification[0].status).toBe('unavailable');
    expect(report.overallStatus).toBe('action-required');
    expect(report.disclaimer).toBe('blind_review.disclaimer');
    expect(report.aiAssistance).toEqual(assessment.aiAssistance);
  });

  it('requires action when any selected external reviewer is unavailable', () => {
    const report = mergeBlindReviewReport(
      { recommendation: 'pass-with-caveats', summary: 'No model issue.', findings: [] },
      [
        {
          reviewer: 'doi-mcp',
          status: 'unavailable',
          checkedAt: '2026-07-28T00:00:00.000Z',
          summary: 'Backend unavailable.',
          records: [],
        },
      ],
      { conference: 'ESC', reviewedAt: '2026-07-28T00:00:00.000Z' }
    );

    expect(report.overallStatus).toBe('action-required');
  });

  it('builds an isolated reviewer prompt covering ethics, de-identification, data, and citations', () => {
    const prompt = buildBlindReviewPrompt({
      conference: 'ISMRM',
      sourceText: 'Source material',
      generatedText: 'Generated abstract',
      locale: 'zh',
    });

    expect(prompt).toContain('ETHICS_AND_CONSENT');
    expect(prompt).toContain('DE_IDENTIFICATION');
    expect(prompt).toContain('DATA_INTEGRITY');
    expect(prompt).toContain('CITATION_INTEGRITY');
    expect(prompt).toContain('Source material');
    expect(prompt).toContain('Generated abstract');
    expect(prompt).toContain('Simplified Chinese');
  });

  it('labels source-only review as a manuscript and includes supplied conference rules', () => {
    const prompt = buildBlindReviewPrompt({
      conference: 'ER',
      sourceText: 'Complete manuscript',
      generatedText: 'Complete manuscript',
      target: 'manuscript',
      conferenceRules: 'ECR current platform rule set: maximum 280 words.',
      locale: 'en',
    });

    expect(prompt).toContain('MANUSCRIPT TO REVIEW');
    expect(prompt).toContain('ECR current platform rule set: maximum 280 words.');
    expect(prompt).not.toContain('GENERATED ABSTRACT');
  });

  it('extracts DOI, PMID, and author-year citation candidates without inventing references', () => {
    const candidates = extractCitationCandidates(
      'Prior work (Smith et al., 2024) supports this. PMID: 12345678. https://doi.org/10.1000/xyz123.'
    );

    expect(candidates).toEqual([
      { kind: 'doi', value: '10.1000/xyz123' },
      { kind: 'pmid', value: '12345678' },
      { kind: 'author-year', value: 'Smith et al., 2024' },
    ]);
  });
});
