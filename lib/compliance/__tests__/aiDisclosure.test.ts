import { beforeEach, describe, expect, it } from 'vitest';
import {
  AI_DISCLOSURE_VERSION,
  acceptAIDisclosure,
  clearAIDisclosureAcceptance,
  createAIAssistanceRecord,
  hasAcceptedAIDisclosure,
  mergeAIAssistanceRecords,
} from '../aiDisclosure';

describe('AI disclosure acceptance', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('requires fresh consent for the current disclosure version', () => {
    expect(hasAcceptedAIDisclosure()).toBe(false);

    acceptAIDisclosure();

    expect(hasAcceptedAIDisclosure()).toBe(true);
    expect(JSON.parse(localStorage.getItem('sci-necromancer.ai-disclosure') ?? '{}')).toMatchObject(
      {
        version: AI_DISCLOSURE_VERSION,
      }
    );
  });

  it('does not accept a stale disclosure version', () => {
    localStorage.setItem(
      'sci-necromancer.ai-disclosure',
      JSON.stringify({ version: '2025-01', acceptedAt: '2025-01-01T00:00:00.000Z' })
    );

    expect(hasAcceptedAIDisclosure()).toBe(false);
  });

  it('can revoke the saved acknowledgement', () => {
    acceptAIDisclosure();
    clearAIDisclosureAcceptance();

    expect(hasAcceptedAIDisclosure()).toBe(false);
  });

  it('merges earlier and current operation records without losing the current record', () => {
    const analysis = createAIAssistanceRecord({
      provider: 'mga',
      model: 'glm-5.2',
      mode: 'standard',
      operations: ['content analysis'],
    });
    const deepUpdate = createAIAssistanceRecord({
      provider: 'mga',
      model: 'gpt-5.6-luna',
      mode: 'standard',
      operations: ['deep revision'],
    });

    const merged = mergeAIAssistanceRecords(
      { aiAssistance: analysis },
      { abstract: 'Updated', impact: '', synopsis: '', keywords: [], aiAssistance: deepUpdate }
    );

    expect(merged.aiAssistance).toBe(deepUpdate);
    expect(merged.aiAssistanceRecords).toEqual(expect.arrayContaining([analysis, deepUpdate]));
  });
});
