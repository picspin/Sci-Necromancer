import { describe, expect, it } from 'vitest';
import {
  JOURNAL_STYLE_TEMPLATES,
  SCHEMATIC_LAYOUTS,
  composeScientificImagePrompt,
  recommendSchematicLayout,
} from './imageTemplateRegistry';

describe('scientific image template registry', () => {
  it('exposes four primary and five secondary journal styles without the retired MRI template', () => {
    expect(
      JOURNAL_STYLE_TEMPLATES.filter((template) => template.tier === 'primary').map(({ id }) => id)
    ).toEqual(['lancet', 'nature', 'nejm', 'science']);
    expect(
      JOURNAL_STYLE_TEMPLATES.filter((template) => template.tier === 'secondary').map(
        ({ id }) => id
      )
    ).toEqual(['jama-bmj', 'radiology', 'ieee', 'cell', 'pnas']);
    expect(JOURNAL_STYLE_TEMPLATES.some(({ id }) => String(id) === 'mri')).toBe(false);
  });

  it('exposes the seven agreed schematic layout structures', () => {
    expect(SCHEMATIC_LAYOUTS.map(({ id }) => id)).toEqual([
      'linear-sequential',
      'central-hub',
      'input-process-output',
      'multi-scale-nested',
      'before-after',
      'contextual-landscape',
      'modular-grid',
    ]);
  });

  it.each([
    ['Longitudinal treatment pathway and downstream cascade', 'linear-sequential'],
    ['Novel drug target and surrounding signaling mechanisms', 'central-hub'],
    ['Deep learning architecture from input through model to output', 'input-process-output'],
    ['Multi-omics analysis from whole organ to single cell', 'multi-scale-nested'],
    ['Control versus treated cohort before and after intervention', 'before-after'],
    ['Tumor microenvironment and immune-cell ecology', 'contextual-landscape'],
    ['Large multicenter cohort systematic review summary', 'modular-grid'],
  ])('recommends a layout for %s', (researchIntent, expectedLayout) => {
    expect(recommendSchematicLayout(researchIntent).layoutId).toBe(expectedLayout);
  });

  it('combines journal taste and layout topology into one generation prompt', () => {
    const prompt = composeScientificImagePrompt({
      journalStyleId: 'radiology',
      layoutId: 'before-after',
      researchIntent: 'Compare baseline and post-treatment MRI biomarkers.',
    });

    expect(prompt).toContain('RADIOLOGY');
    expect(prompt).toContain('Before vs. After');
    expect(prompt).toContain('baseline and post-treatment MRI biomarkers');
    expect(prompt).toContain('Do not invent');
  });
});
