import { describe, expect, it } from 'vitest';
import { listMemberCapabilities, resolveResearchToolKeys } from './capabilityRegistry';

describe('managed MGA capability catalog', () => {
  it('exposes exactly three read-only research tools and one verification agent without provider configuration', () => {
    const catalog = listMemberCapabilities();

    expect(catalog).toEqual([
      expect.objectContaining({ id: 'mga-pubmed', kind: 'mcp', readOnly: true }),
      expect.objectContaining({ id: 'mga-semantic-scholar', kind: 'mcp', readOnly: true }),
      expect.objectContaining({
        id: 'mga-hubble-literature-abstracts',
        kind: 'mcp',
        readOnly: true,
      }),
      expect.objectContaining({
        id: 'mga-research-verification-agent',
        kind: 'agent',
        readOnly: true,
        bonusCost: 1,
      }),
    ]);
    expect(JSON.stringify(catalog)).not.toMatch(/api[_-]?key|base[_-]?url|tool[_-]?key|token/i);
    expect(catalog.every((item) => item.labelKey && item.descriptionKey)).toBe(true);
    expect(catalog.some((item) => 'name' in item || 'description' in item)).toBe(false);
  });

  it('maps only approved member capability IDs to the fixed MGA tool allowlist', () => {
    expect(
      resolveResearchToolKeys([
        'mga-pubmed',
        'mga-semantic-scholar',
        'mga-hubble-literature-abstracts',
      ])
    ).toEqual(['pubmed_data_source', 'semantic_scholar', 'hubble_literature_abstracts']);

    expect(() => resolveResearchToolKeys(['websearch'])).toThrow('invalid_capability_selection');
    expect(() => resolveResearchToolKeys([])).toThrow('invalid_capability_selection');
  });
});
