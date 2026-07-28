import { describe, expect, it } from 'vitest';
import { normalizeBlindReviewSettings } from '../reviewSettings';

describe('blind review settings', () => {
  it('migrates existing settings without requiring endpoint or command configuration', () => {
    const settings = normalizeBlindReviewSettings(undefined);

    expect(settings).toEqual({
      enabled: true,
      reviewers: {
        pubmed: false,
        citecheck: false,
        'doi-mcp': false,
      },
    });
    expect(JSON.stringify(settings)).not.toMatch(/url|command|apiKey/i);
  });

  it('preserves checkbox selections while filling missing reviewer flags', () => {
    const settings = normalizeBlindReviewSettings({
      enabled: true,
      reviewers: { pubmed: true } as never,
    });

    expect(settings.reviewers).toEqual({
      pubmed: true,
      citecheck: false,
      'doi-mcp': false,
    });
  });
});
