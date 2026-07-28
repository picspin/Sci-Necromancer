import type { BlindReviewSettings } from '@/types';

export const DEFAULT_BLIND_REVIEW_SETTINGS: BlindReviewSettings = Object.freeze({
  enabled: true,
  reviewers: Object.freeze({
    pubmed: false,
    citecheck: false,
    'doi-mcp': false,
  }),
});

export function normalizeBlindReviewSettings(
  value?: Partial<BlindReviewSettings>
): BlindReviewSettings {
  return {
    enabled: value?.enabled ?? DEFAULT_BLIND_REVIEW_SETTINGS.enabled,
    reviewers: {
      pubmed: value?.reviewers?.pubmed ?? false,
      citecheck: value?.reviewers?.citecheck ?? false,
      'doi-mcp': value?.reviewers?.['doi-mcp'] ?? false,
    },
  };
}
