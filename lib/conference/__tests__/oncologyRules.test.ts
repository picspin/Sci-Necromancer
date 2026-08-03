import { describe, expect, it } from 'vitest';
import {
  classifyOncologyAbstract,
  buildOncologyPrompt,
  getOncologyProfile,
  validateOncologyDraft,
} from '../oncologyRules';

describe('oncology conference rule profiles', () => {
  it('exposes the approved ASCO submission contract', () => {
    const profile = getOncologyProfile('ASCO');

    expect(profile.ruleVersion).toBe('ASCO Annual Meeting 2026');
    expect(profile.characterLimitExcludingSpaces).toBe(2600);
    expect(profile.submissionTypes.map((type) => type.id)).toEqual([
      'regular',
      'lba-shell',
      'lba-final',
      'trial-in-progress',
    ]);
    expect(profile.presentationPreference).toBe('organizer-assigned');
  });

  it('exposes the approved ESMO submission contract', () => {
    const profile = getOncologyProfile('ESMO');

    expect(profile.ruleVersion).toBe('ESMO Congress 2026');
    expect(profile.characterLimitExcludingSpaces).toBe(2000);
    expect(profile.submissionTypes.map((type) => type.id)).toEqual([
      'regular',
      'lba-intent',
      'lba-final',
      'trial-in-progress',
    ]);
    expect(profile.presentationPreference).toBe('author-preferred-organizer-final');
  });
});

describe('oncology draft validation', () => {
  it('counts ASCO title, body, and table characters while excluding spaces', () => {
    const result = validateOncologyDraft({
      conference: 'ASCO',
      submissionType: 'regular',
      title: 'T'.repeat(100),
      body: `Background: ${'x'.repeat(2400)} Methods: x Results: x Conclusions: x`,
      tableText: 'y'.repeat(100),
      keywords: ['oncology'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('2600');
  });

  it('rejects results in either organizer trial-in-progress pathway', () => {
    for (const conference of ['ASCO', 'ESMO'] as const) {
      const result = validateOncologyDraft({
        conference,
        submissionType: 'trial-in-progress',
        title: 'An ongoing phase II trial',
        body: 'Background: Rationale. Trial design: Ongoing enrollment. Results: ORR was 42%.',
        keywords: ['trial'],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('results or preliminary data');
    }
  });

  it('enforces ESMO table, authorship, presenter, and research-data AI rules', () => {
    const result = validateOncologyDraft({
      conference: 'ESMO',
      submissionType: 'regular',
      title: 'Prospective biomarker study',
      body: 'Background: Test. Methods: Test. Results: Test. Conclusions: Test.',
      tableText: 'x'.repeat(601),
      tableCount: 2,
      authorCount: 21,
      keywords: ['biomarker'],
      containsPatientData: true,
      presenterIsSponsorEmployee: true,
      aiGeneratedOrAnalyzedResearchData: true,
      methodsDescribeAI: false,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('one table');
    expect(result.errors.join(' ')).toContain('600 characters');
    expect(result.errors.join(' ')).toContain('20 authors');
    expect(result.errors.join(' ')).toContain('independent practicing physician or investigator');
    expect(result.errors.join(' ')).toContain('AI use must be described in Methods');
  });

  it('rejects ASCO excess tables, excess rows, figures, and case reports', () => {
    const result = validateOncologyDraft({
      conference: 'ASCO',
      submissionType: 'regular',
      title: 'Case report with imaging figure',
      body: 'Background: Case report. Methods: Review. Results: Finding. Conclusions: Finding.',
      tableCount: 2,
      tableRows: 11,
      hasFigures: true,
      keywords: ['oncology'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('one table');
    expect(result.errors.join(' ')).toContain('10 rows');
    expect(result.errors.join(' ')).toContain('Figures are not allowed');
    expect(result.errors.join(' ')).toContain('Case reports are not eligible');
  });

  it('reports missing pathway-specific sections instead of fabricating them', () => {
    const result = validateOncologyDraft({
      conference: 'ESMO',
      submissionType: 'regular',
      title: 'Biomarker study',
      body: 'Background: Rationale. Methods: Cohort definition. Conclusions: Pending author review.',
      keywords: ['biomarker'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('Results');
  });
});

describe('oncology three-layer classification', () => {
  it('routes an ongoing ESMO AI trial to TiP and a poster-compatible recommendation', () => {
    const classification = classifyOncologyAbstract(
      'ESMO',
      'Background: We developed an artificial intelligence diagnostic model. Trial design: This ongoing phase II prospective clinical trial is currently recruiting and reports no results.'
    );

    expect(classification.submissionType).toBe('trial-in-progress');
    expect(classification.primaryCategory).toBe('AI for diagnostics and profiling');
    expect(classification.studyDesign).toBe('trial-in-progress');
    expect(['poster', 'eposter']).toContain(classification.presentationRecommendation);
    expect(classification.ruleVersion).toBe('ESMO Congress 2026');
  });

  it('builds an ESMO TiP prompt with organizer-specific safeguards', () => {
    const classification = classifyOncologyAbstract(
      'ESMO',
      'An ongoing phase II trial currently recruiting with no results.'
    );
    const prompt = buildOncologyPrompt('ESMO', 'Source material', classification, 'standard');

    expect(prompt).toContain('ESMO Congress 2026');
    expect(prompt).toContain('Background and Trial design only');
    expect(prompt).toContain('must not include results or preliminary data');
    expect(prompt).toContain('2,000 characters excluding spaces');
    expect(prompt).toContain('Poster or ePoster');
    expect(prompt).toContain('describe the model and its use in Methods');
    expect(prompt).toContain('Never invent');
    expect(prompt).toContain('Source material');
  });
});
