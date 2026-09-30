import { describe, expect, it } from 'vitest';
import { ERModule } from './ERModule';

describe('ECR 2027 module', () => {
  const module = new ERModule();

  it('keeps only the four core sections mandatory', () => {
    expect(module.guidelines.requiredSections).toEqual([
      'PURPOSE or LEARNING OBJECTIVE',
      'METHODS or BACKGROUND',
      'RESULTS or FINDINGS',
      'CONCLUSIONS',
    ]);
    expect(module.submissionUrl).toContain('/congress/submit/abstract-submission/');
  });

  it('does not demand funding or ethics text inside the abstract body', () => {
    const result = module.validateAbstract({
      title: 'MRI for pulmonary nodules',
      abstract:
        'PURPOSE: To evaluate MRI. METHODS: We reviewed imaging. RESULTS: MRI detected nodules. CONCLUSIONS: MRI was feasible.',
      impact: '',
      synopsis: '',
      keywords: ['MRI'],
    });

    expect(result.isValid).toBe(true);
    expect(result.warnings.join(' ')).not.toMatch(/ethics approval|funding information/i);
  });

  it('flags acknowledgements in the submission body for author review', () => {
    const result = module.validateAbstract({
      abstract:
        'PURPOSE: Evaluate CT. METHODS: Review imaging. RESULTS: CT worked. CONCLUSIONS: Further study is needed. Acknowledgements: AI edited this abstract.',
      impact: '',
      synopsis: '',
      keywords: ['CT'],
    });

    expect(result.warnings).toContain(
      'ECR 2027 excludes acknowledgements and references from the abstract body'
    );
  });
});
