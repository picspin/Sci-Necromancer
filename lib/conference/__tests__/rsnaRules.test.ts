import { describe, expect, it } from 'vitest';
import {
  RSNA_RULESET,
  enforceRSNASourceFidelity,
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
      keywords: ['AI', 'Artificial Intelligence', 'MRI', 'Invented Keyword'],
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
    expect(result.keywords).toEqual(['Artificial Intelligence/Machine Learning', 'MRI']);
    expect(result.rsna.primaryPresentationFormat).toBe('scientific-paper');
    expect(result.rsna.ruleVersion).toBe(RSNA_RULESET.version);
    expect(result.rsna.warnings.join(' ')).toContain('keyword suggestion');
  });

  it('downgrades cutting-edge when no exact eligible topic is present', () => {
    const result = normalizeRSNAAnalysis({
      categories: [{ name: 'Physics', type: 'main', probability: 1 }],
      keywords: ['MRI'],
      rsna: {
        track: 'cutting-edge',
        contentType: 'science',
        primaryPresentationFormat: 'scientific-paper',
      },
    });

    expect(result.rsna.track).toBe('regular');
    expect(result.rsna.warnings.join(' ')).toContain('downgraded');
  });

  it('does not apply TRIPOD+AI to non-prediction machine-learning imaging work', () => {
    expect(inferReportingGuidelines('Machine learning reconstruction reduced MRI noise.')).toEqual(
      []
    );
    expect(
      inferReportingGuidelines('We developed and validated a diagnostic prediction model.')
    ).toEqual(['TRIPOD+AI for Abstracts']);
  });

  it('removes model-selected reporting extensions that the source does not support', () => {
    const result = normalizeRSNAAnalysis(
      {
        categories: [{ name: 'Physics', type: 'main', probability: 1 }],
        keywords: ['MRI'],
        rsna: {
          track: 'regular',
          contentType: 'science',
          primaryPresentationFormat: 'scientific-paper',
          reportingGuidelines: ['STARD for Abstracts', 'TRIPOD+AI for Abstracts'],
        },
      },
      'Machine learning reconstruction reduced image noise.'
    );

    expect(result.rsna.reportingGuidelines).toEqual([]);
    expect(result.rsna.warnings.join(' ')).toContain('not supported');
  });

  it('retains representative category-specific terms from the agreed RSNA keyword reference', () => {
    const result = normalizeRSNAAnalysis({
      categories: [{ name: 'Cardiac Imaging', type: 'main', probability: 1 }],
      keywords: ['Perfusion', 'Biopsy', 'CT Angiography', 'Urolithiasis', 'Theranostics'],
    });

    expect(result.keywords).toEqual([
      'Perfusion',
      'Biopsy',
      'CT Angiography',
      'Urolithiasis',
      'Theranostics',
    ]);
  });

  it('replaces generated numbers and approval claims that are absent from the source', () => {
    const result = enforceRSNASourceFidelity(
      {
        title: 'Test',
        abstract: 'RESULTS: Accuracy was 97%. Institutional review board approval was obtained.',
        impact: 'Test',
        synopsis: 'Test',
        keywords: ['MRI'],
      },
      'The source describes an MRI study but provides no results or approval status.'
    );

    expect(result.abstract).not.toContain('97%');
    expect(result.abstract).toContain('[INSERT verified value]');
    expect(result.abstract).toContain('[INSERT verified ethics approval]');
    expect(result.complianceWarnings?.join(' ')).toContain('Unsupported');
  });

  it('gates all factual output fields while preserving five-slide structural indices', () => {
    const result = enforceRSNASourceFidelity(
      {
        title: 'A 99% accurate model',
        abstract: 'RESULTS: No quantitative results were supplied.',
        impact: 'Accuracy improved by 15%.',
        synopsis: 'IRB approval was obtained.',
        keywords: ['MRI'],
        presentationGuidance: [
          'Slide 1: Show the claimed 42% improvement.',
          'Slide 2: Teaching overview.',
          'Slide 3: Cases.',
          'Slide 4: Pitfalls.',
          'Slide 5: Summary.',
        ],
      },
      'IRB approval was not obtained. No quantitative results were reported.'
    );

    expect(result.title).toContain('[INSERT verified value]');
    expect(result.impact).toContain('[INSERT verified value]');
    expect(result.synopsis).toContain('[INSERT verified ethics approval]');
    expect(result.presentationGuidance?.[0]).toContain('Slide 1');
    expect(result.presentationGuidance?.[0]).toContain('[INSERT verified value]');
    expect(result.presentationGuidance?.[4]).toContain('Slide 5');
  });

  it('replaces a later status claim when it contradicts the source', () => {
    const result = enforceRSNASourceFidelity(
      {
        title: 'Test',
        abstract: 'IRB approval was obtained. IRB approval was not obtained.',
        impact: 'Test',
        synopsis: 'Test',
        keywords: ['MRI'],
      },
      'IRB approval was obtained.'
    );

    expect(result.abstract).toContain('IRB approval was obtained.');
    expect(result.abstract).toContain('[INSERT verified ethics approval]');
    expect(result.abstract).not.toContain('IRB approval was not obtained');
  });

  it('preserves structural numbering in an education table of contents', () => {
    const result = enforceRSNASourceFidelity(
      {
        title: 'Teaching exhibit',
        abstract:
          'TEACHING POINTS: Review patterns. TABLE OF CONTENTS: 1. Background 2. Cases 3. Pitfalls.',
        impact: 'Teaching resource.',
        synopsis: 'Review.',
        keywords: ['Education/Training'],
      },
      'Review imaging patterns, cases, and pitfalls.'
    );

    expect(result.abstract).toContain('1. Background 2. Cases 3. Pitfalls');
    expect(result.abstract).not.toContain('[INSERT verified value]');
  });

  it('does not mistake a sentence-final result integer for an outline index', () => {
    const result = enforceRSNASourceFidelity(
      {
        title: 'Study',
        abstract:
          'PURPOSE: Test. MATERIALS AND METHODS: Test. RESULTS: There were 20. CONCLUSION: Test.',
        impact: 'Test.',
        synopsis: 'Test.',
        keywords: ['MRI'],
      },
      'The source provides no sample size.'
    );

    expect(result.abstract).not.toContain('There were 20.');
    expect(result.abstract).toContain('[INSERT verified value]');
  });

  it('does not treat ordinary prose containing outlines as an outline heading', () => {
    const result = enforceRSNASourceFidelity(
      {
        title: 'Study',
        abstract:
          'PURPOSE: This abstract outlines the workflow. We enrolled 20. Patients underwent MRI.',
        impact: 'Test.',
        synopsis: 'Test.',
        keywords: ['MRI'],
      },
      'The source describes an MRI workflow without a sample size.'
    );

    expect(result.abstract).not.toContain('enrolled 20.');
    expect(result.abstract).toContain('[INSERT verified value]');
  });
});
