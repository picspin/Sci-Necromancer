import { describe, expect, it, vi } from 'vitest';
import { runBlindReview } from '../blindReviewService';

describe('runBlindReview', () => {
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
        conference: 'ESC',
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
    expect(report.conference).toBe('ESC');
    expect(report.externalVerification[0].reviewer).toBe('pubmed');
  });
});
