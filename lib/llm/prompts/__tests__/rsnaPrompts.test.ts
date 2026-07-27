import { describe, expect, it } from 'vitest';
import type { RSNAClassification } from '@/types';
import {
  getRSNAAnalysisPrompt,
  getRSNAGenerationPrompt,
  getRSNACreativePrompt,
} from '../rsnaPrompts';

const scienceClassification: RSNAClassification = {
  track: 'cutting-edge',
  contentType: 'science',
  cuttingEdgeTopic: 'High-Impact Clinical Trials in Radiology',
  primaryPresentationFormat: 'scientific-paper',
  alternativePresentationFormats: ['digital-presentation'],
  reportingGuidelines: ['TRIPOD+AI for Abstracts'],
  confidence: 0.88,
  rationale: ['Multicenter prospective clinical trial'],
  warnings: [],
  ruleVersion: 'RSNA-2026-provisional-2023-fallback',
};

describe('RSNA prompts', () => {
  it('asks analysis for the three-layer model and only one final category', () => {
    const prompt = getRSNAAnalysisPrompt('Study text');

    expect(prompt).toContain('submission track');
    expect(prompt).toContain('science or education');
    expect(prompt).toContain('exactly one primary RSNA category');
    expect(prompt).toContain('High-Impact Clinical Trials in Radiology');
  });

  it('injects provisional RSNA rules and conditional reporting guidance into generation', () => {
    const prompt = getRSNAGenerationPrompt({
      inputText: 'Original study facts',
      category: 'Neuroradiology',
      keywords: ['MRI'],
      classification: scienceClassification,
      mode: 'standard',
    });

    expect(prompt).toContain('2400 characters excluding spaces');
    expect(prompt).toContain('Clinical Relevance');
    expect(prompt).toContain('TRIPOD+AI for Abstracts');
    expect(prompt).toContain('Do not invent');
    expect(prompt).toContain('[INSERT ');
  });

  it('keeps creative polishing factual and uses the education output contract', () => {
    const prompt = getRSNACreativePrompt({
      inputText: 'Teaching review source material',
      category: 'Education',
      keywords: ['MRI'],
      classification: {
        ...scienceClassification,
        track: 'regular',
        contentType: 'education',
        cuttingEdgeTopic: undefined,
        primaryPresentationFormat: 'digital-presentation',
        reportingGuidelines: [],
      },
      mode: 'creative',
    });

    expect(prompt).toContain('Teaching Points');
    expect(prompt).toContain('Five-slide Review PDF Plan');
    expect(prompt).toContain('never fabricate');
  });
});
