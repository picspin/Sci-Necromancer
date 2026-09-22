import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptAIDisclosure } from '@/lib/compliance/aiDisclosure';
import { clearTextModelWorkflows } from '@/lib/llm/textModelWorkflow';

const { generateContentMock, tryJevContentAnalysisMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  tryJevContentAnalysisMock: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));
vi.mock('@/lib/llm/jevAnalysis', () => ({ tryJevContentAnalysis: tryJevContentAnalysisMock }));
vi.mock('@/src/composables/useMembership', () => ({
  canUseManagedText: () => false,
  hasManagedCredits: () => true,
  canUseManagedResearchVerification: () => false,
  generateManagedText: vi.fn(),
  generateManagedResearchVerification: vi.fn(),
}));

describe('Jev isolation from BYOK analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearTextModelWorkflows();
    acceptAIDisclosure();
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        provider: 'google',
        googleApiKey: 'byok-key',
        model: 'gemini-test',
        textGenerationSource: 'byok',
      })
    );
    generateContentMock.mockResolvedValue({ text: '{"categories":[],"keywords":[]}' });
  });

  it('does not call Jev and uses the configured BYOK provider despite the frontend flag', async () => {
    const { analyzeContentForConference } = await import('@/lib/llm/index');
    await analyzeContentForConference('Private manuscript source', 'ER');
    expect(tryJevContentAnalysisMock).not.toHaveBeenCalled();
    expect(generateContentMock).toHaveBeenCalledOnce();
  });
});
