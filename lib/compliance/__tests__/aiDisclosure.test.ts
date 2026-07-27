import { beforeEach, describe, expect, it } from 'vitest';
import {
  AI_DISCLOSURE_VERSION,
  acceptAIDisclosure,
  clearAIDisclosureAcceptance,
  hasAcceptedAIDisclosure,
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
});
