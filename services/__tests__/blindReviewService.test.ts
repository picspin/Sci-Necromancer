import { describe, expect, it, vi } from 'vitest';
import { runBlindReview } from '../blindReviewService';

describe('runBlindReview', () => {
  it('reviews a source manuscript directly with the active conference rule context', async () => {
    const modelReview = vi.fn(async () => ({
      recommendation: 'pass-with-caveats' as const,
      summary: 'Review',
      findings: [],
    }));
    const externalReview = vi.fn(async () => []);

    await runBlindReview(
      {
        conference: 'ASCO',
        sourceText: 'Complete manuscript body',
        target: 'manuscript',
        locale: 'en',
        settings: {
          enabled: true,
          reviewers: { pubmed: true, citecheck: false, 'doi-mcp': false },
        },
      },
      { modelReview, externalReview, now: () => '2026-08-25T00:00:00.000Z' }
    );

    expect(modelReview.mock.calls[0][0]).toContain('MANUSCRIPT TO REVIEW');
    expect(modelReview.mock.calls[0][1]).toBe('manuscript');
    expect(modelReview.mock.calls[0][0]).toContain('ASCO Annual Meeting 2026');
    expect(modelReview.mock.calls[0][0]).toContain('2600 characters excluding spaces');
    expect(externalReview).toHaveBeenCalledWith(
      expect.objectContaining({ generatedText: 'Complete manuscript body' })
    );
  });

  it('does not call the backend when no evidence reviewer is selected', async () => {
    const externalReview = vi.fn();
    await runBlindReview(
      {
        conference: 'ER',
        sourceText: 'Source',
        abstract: { impact: '', synopsis: '', abstract: 'Generated', keywords: [] },
        locale: 'en',
        settings: {
          enabled: true,
          reviewers: { pubmed: false, citecheck: false, 'doi-mcp': false },
        },
      },
      {
        modelReview: async () => ({
          recommendation: 'pass-with-caveats',
          summary: 'Review',
          findings: [],
        }),
        externalReview,
        now: () => '2026-07-28T00:00:00.000Z',
      }
    );
    expect(externalReview).not.toHaveBeenCalled();
  });

  it('keeps the model review and marks selected evidence services unavailable when the backend fails', async () => {
    const report = await runBlindReview(
      {
        conference: 'RSNA',
        sourceText: 'Source',
        abstract: { impact: '', synopsis: '', abstract: 'Generated', keywords: [] },
        locale: 'en',
        settings: {
          enabled: true,
          reviewers: { pubmed: true, citecheck: true, 'doi-mcp': false },
        },
      },
      {
        modelReview: async () => ({
          recommendation: 'minor-revision',
          summary: 'Review',
          findings: [],
        }),
        externalReview: async () => {
          throw new Error('network unavailable');
        },
        now: () => '2026-07-28T00:00:00.000Z',
      }
    );

    expect(report.externalVerification.map(({ reviewer, status }) => [reviewer, status])).toEqual([
      ['pubmed', 'unavailable'],
      ['citecheck', 'unavailable'],
    ]);
  });

  it('reviews generated content against the original source and selected backend reviewers', async () => {
    const modelReview = vi.fn(async () => ({
      recommendation: 'minor-revision' as const,
      summary: 'Independent review complete.',
      findings: [],
    }));
    const externalReview = vi.fn(async () => [
      {
        reviewer: 'pubmed' as const,
        status: 'verified' as const,
        checkedAt: '2026-07-28T00:00:00.000Z',
        summary: 'Related records found; dataset remains author-verified.',
        records: [],
      },
    ]);

    const report = await runBlindReview(
      {
        conference: 'ER',
        sourceText: 'Original source with 80 participants.',
        abstract: {
          title: 'Study title',
          impact: 'Impact',
          synopsis: 'Synopsis',
          abstract: 'Generated abstract with 80 participants.',
          keywords: ['MRI'],
        },
        locale: 'en',
        settings: {
          enabled: true,
          reviewers: { pubmed: true, citecheck: false, 'doi-mcp': false },
        },
      },
      {
        modelReview,
        externalReview,
        now: () => '2026-07-28T00:00:00.000Z',
      }
    );

    expect(modelReview.mock.calls[0][0]).toContain('Original source with 80 participants.');
    expect(externalReview.mock.calls[0][0].reviewers.pubmed).toBe(true);
    expect(report.conference).toBe('ER');
    expect(report.externalVerification[0].reviewer).toBe('pubmed');
  });
});
