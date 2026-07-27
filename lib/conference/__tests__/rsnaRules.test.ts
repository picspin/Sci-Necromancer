import { describe, expect, it } from 'vitest';
import {
  RSNA_RULESET,
  getAllowedPresentationFormats,
  inferReportingGuidelines,
  normalizeRSNAAnalysis,
} from '../rsnaRules';

describe('RSNA rules', () => {
  it('uses the approved 2023 provisional limits with auditable provenance', () => {
    expect(RSNA_RULESET.status).toBe('provisional');
    expect(RSNA_RULESET.fallbackYear).toBe(2023);
    expect(RSNA_RULESET.science.abstractCharactersExcludingSpaces).toBe(2400);
    expect(RSNA_RULESET.science.clinicalRelevanceCharacters).toBe(200);
    expect(RSNA_RULESET.education.abstractCharacters).toBe(1350);
    expect(RSNA_RULESET.education.reviewPdfSlides).toBe(5);
    expect(RSNA_RULESET.sources.every((source) => source.url.length > 0)).toBe(true);
  });

  it('keeps presentation eligibility constrained by science and education', () => {
    expect(getAllowedPresentationFormats('science')).toEqual([
      'scientific-paper',
      'digital-presentation',
      'hardcopy-presentation',
    ]);
    expect(getAllowedPresentationFormats('education')).toEqual([
      'digital-presentation',
      'standalone-education-exhibit',
      'hardcopy-presentation',
      'learning-center-theater',
    ]);
  });

  it('conditionally applies STARD and TRIPOD+AI without treating them as universal', () => {
    expect(
      inferReportingGuidelines('We evaluated diagnostic accuracy, sensitivity and AUC.')
    ).toEqual(['STARD for Abstracts']);
    expect(
      inferReportingGuidelines(
        'We developed and externally validated a machine learning prediction model.'
      )
    ).toEqual(['TRIPOD+AI for Abstracts']);
    expect(
      inferReportingGuidelines(
        'Diagnostic prediction model sensitivity and external validation were assessed.'
      )
    ).toEqual(['STARD for Abstracts', 'TRIPOD+AI for Abstracts']);
    expect(inferReportingGuidelines('We compared image reconstruction time.')).toEqual([]);
  });

  it('normalizes model output to one category and an eligible presentation format', () => {
    const result = normalizeRSNAAnalysis({
      categories: [
        { name: 'Neuroradiology', type: 'main', probability: 0.82 },
        { name: 'Physics', type: 'main', probability: 0.71 },
        { name: 'Invented Category', type: 'main', probability: 0.99 },
      ],
      keywords: ['AI', 'Artificial Intelligence', 'MRI'],
      rsna: {
        track: 'regular',
        contentType: 'science',
        primaryPresentationFormat: 'standalone-education-exhibit',
        alternativePresentationFormats: ['scientific-paper'],
        reportingGuidelines: [],
        confidence: 0.8,
        rationale: ['Hypothesis-driven study'],
        warnings: [],
        ruleVersion: '',
      },
    });

    expect(result.categories).toHaveLength(2);
    expect(result.keywords).toEqual(['Artificial Intelligence', 'MRI']);
    expect(result.rsna.primaryPresentationFormat).toBe('scientific-paper');
    expect(result.rsna.ruleVersion).toBe(RSNA_RULESET.version);
  });
});
