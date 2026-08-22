import { describe, expect, it } from 'vitest';
import type { AIAssistanceRecord } from '../../types';
import { buildAIAcknowledgement, buildMethodsDisclosureNote } from './aiDisclosure';

const record: AIAssistanceRecord = {
  disclosureVersion: 'jama-2026-v1',
  platform: {
    name: 'Sci-Necromancer',
    project: 'picspin/Sci-Necromancer',
    url: 'https://www.rad-sci.org',
  },
  generatedAt: '2026-08-22T08:00:00.000Z',
  provider: 'openai',
  model: 'gpt-5.1',
  modelType: 'large-language-model',
  mode: 'standard',
  operations: ['abstract drafting', 'language revision'],
  boundaries: ['factual claims', 'statistics', 'references'],
  methodsDisclosureRequired: false,
  authorVerificationRequired: true,
};

describe('journal-ready AI acknowledgement', () => {
  it('identifies the platform, project, exact model, date, use, limits, and author responsibility', () => {
    const acknowledgement = buildAIAcknowledgement(record);

    expect(acknowledgement).toContain(
      'Sci-Necromancer (PicSpin project: picspin/Sci-Necromancer; https://www.rad-sci.org)'
    );
    expect(acknowledgement).toContain('gpt-5.1 large language model provided through OpenAI');
    expect(acknowledgement).toContain('on 2026-08-22');
    expect(acknowledgement).toContain('abstract drafting and language revision');
    expect(acknowledgement).toContain(
      'did not independently verify factual claims, statistics, or references'
    );
    expect(acknowledgement).toContain(
      'The authors reviewed the AI-assisted content and take full responsibility for its accuracy, integrity, originality, and compliance.'
    );
  });

  it('adds a Methods reminder only when AI formed part of the research process', () => {
    expect(buildMethodsDisclosureNote(record)).toBeNull();
    expect(buildMethodsDisclosureNote({ ...record, methodsDisclosureRequired: true })).toContain(
      'also be described in the Methods section'
    );
  });

  it('upgrades a legacy saved assistance record without breaking display or export', () => {
    const legacyRecord = {
      generatedAt: '2026-07-28T00:00:00.000Z',
      provider: 'google',
      model: 'gemini-2.5-pro',
      mode: 'standard',
      operations: ['language editing'],
      authorVerificationRequired: true,
    } as unknown as AIAssistanceRecord;

    const acknowledgement = buildAIAcknowledgement(legacyRecord);

    expect(acknowledgement).toContain('picspin/Sci-Necromancer');
    expect(acknowledgement).toContain('https://www.rad-sci.org');
    expect(acknowledgement).toContain('gemini-2.5-pro large language model');
    expect(acknowledgement).toContain('did not independently verify source data, factual claims');
    expect(buildMethodsDisclosureNote(legacyRecord)).toBeNull();
  });
});
