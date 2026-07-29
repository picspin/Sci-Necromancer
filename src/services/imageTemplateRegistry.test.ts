import { describe, expect, it } from 'vitest';
import {
  JOURNAL_STYLE_TEMPLATES,
  SCHEMATIC_LAYOUTS,
  composeScientificImagePrompt,
  composeTemplateSpecsText,
  extractResearchIntent,
  hasManagedImageTemplate,
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

  it('renders editable specs from the selected journal and layout without nesting old templates', () => {
    const jama = composeTemplateSpecsText({
      journalStyleId: 'jama-bmj',
      layoutId: 'linear-sequential',
      researchIntent: 'biomedical cohort pathway\nresolution: 2048x2048\ncolor: muted',
    });
    const radiology = composeTemplateSpecsText({
      journalStyleId: 'radiology',
      layoutId: 'before-after',
      researchIntent: jama,
    });

    expect(jama).toContain('JAMA & BMJ');
    expect(jama).toContain('British clinical');
    expect(jama).toContain('Linear / Sequential Flow');
    expect(radiology).toContain('RADIOLOGY');
    expect(radiology).toContain('Medical Imaging');
    expect(radiology).toContain('Before vs. After');
    expect(radiology).not.toContain('Linear / Sequential Flow');
    expect(hasManagedImageTemplate(radiology)).toBe(true);
    expect(extractResearchIntent(radiology)).toBe(
      'biomedical cohort pathway\nresolution: 2048x2048\ncolor: muted'
    );
    expect(radiology.match(/Research intent and custom constraints:/g)).toHaveLength(1);
    expect(radiology.match(/2048x2048/g)).toHaveLength(1);
  });
});
