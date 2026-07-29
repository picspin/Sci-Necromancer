import { describe, expect, it } from 'vitest';
import { imageSpecsEngine } from './imageSpecsEngine';
import { JOURNAL_STYLE_TEMPLATES, SCHEMATIC_LAYOUTS } from './imageTemplateRegistry';

describe('image specs structured output', () => {
  it('uses the selected template rules instead of Nature/single defaults', () => {
    const fields = imageSpecsEngine.parseInput('biomedical');
    const output = JSON.parse(
      imageSpecsEngine.toJSON(fields, {
        journalStyle: JOURNAL_STYLE_TEMPLATES.find(({ id }) => id === 'jama-bmj')!,
        schematicLayout: SCHEMATIC_LAYOUTS.find(({ id }) => id === 'linear-sequential')!,
      })
    );

    expect(output.journal_style).toBe('JAMA & BMJ');
    expect(output.layout).toBe('Linear / Sequential Flow');
    expect(output.visual_taste).toContain('British clinical');
    expect(output.layout_rules).toContain('cascade');
  });
});
