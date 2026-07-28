import { describe, expect, it } from 'vitest';
import { RSNAModule } from '../modules/RSNAModule';

describe('RSNAModule validation', () => {
  const module = new RSNAModule();

  it('validates science using provisional character limits rather than generic word limits', () => {
    const result = module.validateAbstract({
      title: 'MRI biomarker evaluation',
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
    expect(result.warnings.join(' ')).toContain('current official RSNA requirements');
  });

  it('validates the distinct education structure', () => {
    const result = module.validateAbstract({
      title: 'Pattern recognition teaching exhibit',
      abstract:
        'TEACHING POINTS: Recognize the pattern. TABLE OF CONTENTS/OUTLINE: Cases and review.',
      impact: '',
      synopsis: '',
      keywords: ['Education'],
      presentationGuidance: [
        'Slide 1: Teaching overview',
        'Slide 2: Original image examples',
        'Slide 3: Diagnostic approach',
        'Slide 4: Pitfalls',
        'Slide 5: Summary',
      ],
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
      title: 'Long abstract',
      abstract: `PURPOSE:${'x'.repeat(2401)} MATERIALS AND METHODS: x RESULTS: x CONCLUSION: x`,
      impact: 'Relevant.',
      synopsis: '',
      keywords: ['MRI'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('2400');
  });

  it('rejects an education exhibit without a title and complete five-slide plan', () => {
    const result = module.validateAbstract({
      abstract: 'TEACHING POINTS: Test. TABLE OF CONTENTS/OUTLINE: Test.',
      impact: '',
      synopsis: '',
      keywords: ['Education/Training'],
      presentationGuidance: ['Slide 1: Overview'],
      rsna: {
        track: 'regular',
        contentType: 'education',
        primaryPresentationFormat: 'digital-presentation',
        alternativePresentationFormats: [],
        reportingGuidelines: [],
        confidence: 1,
        rationale: [],
        warnings: [],
        ruleVersion: 'RSNA-2026-provisional-2023-fallback',
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Title is required');
    expect(result.errors.join(' ')).toContain('five-slide');
  });

  it('flags institution identifiers in the title for double-blind review', () => {
    const result = module.validateAbstract({
      title: 'Experience at Example University Hospital',
      abstract: 'PURPOSE: Test. MATERIALS AND METHODS: Test. RESULTS: Test. CONCLUSION: Test.',
      impact: 'Test.',
      synopsis: '',
      keywords: ['MRI'],
    });

    expect(result.warnings.join(' ')).toContain('institution identifier');
  });
});
