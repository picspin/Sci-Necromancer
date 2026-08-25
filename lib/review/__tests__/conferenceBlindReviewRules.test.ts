import { describe, expect, it } from 'vitest';
import { getConferenceBlindReviewRules } from '../conferenceBlindReviewRules';

describe('conference blind-review rule context', () => {
  it('includes the complete platform ECR constraints and an official-rule recheck warning', () => {
    const rules = getConferenceBlindReviewRules('ER');

    expect(rules).toContain('impact statement: 50 words');
    expect(rules).toContain('synopsis: 100 words');
    expect(rules).toContain('Maximum 9 authors');
    expect(rules).toContain('up to 10 images for posters');
    expect(rules).toContain('no full stop, trade names, or special symbols');
    expect(rules).toContain('complete paragraph ending with a full stop');
    expect(rules).toContain('conflicts of interest');
    expect(rules).toContain('authors must recheck the official call');
  });

  it.each(['ASCO', 'ESMO'] as const)(
    'states that the %s character limit is combined and versioned',
    (conference) => {
      const rules = getConferenceBlindReviewRules(conference);

      expect(rules).toContain('Combined title, abstract body, and table text');
      expect(rules).toContain('authors must recheck the official call');
      expect(rules).toMatch(/2026/);
      expect(rules).toContain('Trial-in-progress abstracts must not include results');
      expect(rules).toContain('Case reports and figures are not allowed');
    }
  );

  it('includes the canonical ASCO table limits', () => {
    const rules = getConferenceBlindReviewRules('ASCO');

    expect(rules).toContain('at most one table with no more than 10 rows');
  });

  it('includes the canonical ESMO table, author, presenter, and AI-method limits', () => {
    const rules = getConferenceBlindReviewRules('ESMO');

    expect(rules).toContain('at most one table of no more than 600 characters');
    expect(rules).toContain('no more than 20 authors');
    expect(rules).toContain('independent practicing physician or investigator');
    expect(rules).toContain('AI use affecting research data must be described in Methods');
  });

  it('marks ISMRM rules as platform-configured and points authors to the official call', () => {
    const rules = getConferenceBlindReviewRules('ISMRM');

    expect(rules).toContain('platform-configured');
    expect(rules).toContain('https://www.ismrm.org/26m/call/');
    expect(rules).toContain('authors must recheck the official call');
  });
});
