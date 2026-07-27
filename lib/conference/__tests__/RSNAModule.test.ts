import { describe, expect, it } from 'vitest';
import { RSNAModule } from '../modules/RSNAModule';

describe('RSNAModule validation', () => {
  const module = new RSNAModule();

  it('validates science using provisional character limits rather than generic word limits', () => {
    const result = module.validateAbstract({
      abstract:
        'PURPOSE: Evaluate MRI. MATERIALS AND METHODS: Existing data were analyzed. RESULTS: Accuracy was reported. CONCLUSION: MRI was useful.',
      impact: 'May improve imaging decisions.',
      synopsis: '',
      keywords: ['MRI'],
      rsna: {
        track: 'regular',
        contentType: 'science',
        primaryPresentationFormat: 'scientific-paper',
        alternativePresentationFormats: ['digital-presentation'],
        reportingGuidelines: [],
        confidence: 0.8,
        rationale: [],
        warnings: [],
        ruleVersion: 'RSNA-2026-provisional-2023-fallback',
      },
    });

    expect(result.isValid).toBe(true);
    expect(result.warnings.join(' ')).toContain('provisional');
  });

  it('validates the distinct education structure', () => {
    const result = module.validateAbstract({
      abstract:
        'TEACHING POINTS: Recognize the pattern. TABLE OF CONTENTS/OUTLINE: Cases and review.',
      impact: '',
      synopsis: '',
      keywords: ['Education'],
      rsna: {
        track: 'regular',
        contentType: 'education',
        primaryPresentationFormat: 'digital-presentation',
        alternativePresentationFormats: ['standalone-education-exhibit'],
        reportingGuidelines: [],
        confidence: 0.8,
        rationale: [],
        warnings: [],
        ruleVersion: 'RSNA-2026-provisional-2023-fallback',
      },
    });

    expect(result.isValid).toBe(true);
  });

  it('rejects science content above 2400 characters excluding spaces', () => {
    const result = module.validateAbstract({
      abstract: `PURPOSE:${'x'.repeat(2401)} MATERIALS AND METHODS: x RESULTS: x CONCLUSION: x`,
      impact: 'Relevant.',
      synopsis: '',
      keywords: ['MRI'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('2400');
  });
});
