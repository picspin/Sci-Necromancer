import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTrustedAIAssistance } from '@/lib/compliance/aiDisclosure';
import {
  abandonManagedTextWorkflow,
  acquireManagedTextCall,
  getManagedTextWorkflowState,
} from '@/lib/llm/managedTextWorkflow';
import { clearTextModelWorkflows, lockTextModelForAnalysis } from '@/lib/llm/textModelWorkflow';

const mocks = vi.hoisted(() => ({
  canUseJev: vi.fn(() => true),
  jevAnalyze: vi.fn(),
}));

vi.mock('@/src/composables/useMembership', () => ({
  canUseJev: mocks.canUseJev,
  useMembership: () => ({ memberApi: { jevAnalyze: mocks.jevAnalyze } }),
}));

import { analyzeJevContent, canUseJevForConference } from '@/lib/llm/jevAnalysis';

const text = 'MRI acquisition time was measured in 42 volunteers.';
const context = `ISMRM:${text}`;
const workflowId = '550e8400-e29b-41d4-a716-446655440000';

describe('member Jev analysis and paid generation handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    abandonManagedTextWorkflow(context);
    clearTextModelWorkflows();
    lockTextModelForAnalysis(context, { source: 'managed', provider: 'mga', model: 'glm-5.2' });
    mocks.canUseJev.mockReturnValue(true);
    mocks.jevAnalyze.mockResolvedValue({
      analysis: {
        categories: [{ name: 'Acquisition Methods', type: 'main', probability: 0.9 }],
        keywords: ['MRI'],
      },
      preflight: { needsReview: false },
      provider: 'typesafe',
      model: 'jev-1.13.0',
      workflowId,
      workflow: { analysisCount: 1, generationCount: 0, deepUpdateCount: 0, callCount: 1 },
    });
  });

  it('registers the server workflow so generation continues on the same one-credit task', async () => {
    const analysis = await analyzeJevContent(text, 'ISMRM', context);
    expect(mocks.jevAnalyze).toHaveBeenCalledWith({
      text,
      conference: 'ISMRM',
      idempotencyKey: expect.any(String),
      model: 'glm-5.2',
    });
    expect(getTrustedAIAssistance(analysis)).toMatchObject({
      provider: 'typesafe',
      model: 'jev-1.13.0',
    });
    expect(getManagedTextWorkflowState(context)?.serverId).toBe(workflowId);
    expect(acquireManagedTextCall('generation', context)).toMatchObject({
      operation: 'generation',
      workflowId,
    });
  });

  it('does not send BYOK-mode content to TypeSafe', async () => {
    mocks.canUseJev.mockReturnValue(false);
    expect(canUseJevForConference('ISMRM')).toBe(false);
    await expect(analyzeJevContent(text, 'ISMRM', context)).rejects.toThrow(
      'typesafe_jev_unavailable'
    );
    expect(mocks.jevAnalyze).not.toHaveBeenCalled();
  });

  it('does not invent a generation workflow on provider failure', async () => {
    mocks.jevAnalyze.mockRejectedValue(new Error('typesafe_jev_unavailable'));
    await expect(analyzeJevContent(text, 'ISMRM', context)).rejects.toThrow(
      'typesafe_jev_unavailable'
    );
    expect(getManagedTextWorkflowState(context)?.serverId).toBeUndefined();
  });

  it('coalesces simultaneous analysis clicks so the first workflow ID is not lost', async () => {
    let release!: (value: unknown) => void;
    mocks.jevAnalyze.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const first = analyzeJevContent(text, 'ISMRM', context);
    const second = analyzeJevContent(text, 'ISMRM', context);
    expect(mocks.jevAnalyze).toHaveBeenCalledOnce();
    release({
      analysis: {
        categories: [{ name: 'Acquisition Methods', type: 'main', probability: 0.9 }],
        keywords: ['MRI'],
      },
      model: 'jev-1.13.0',
      workflowId,
      workflow: { analysisCount: 1, generationCount: 0, deepUpdateCount: 0, callCount: 1 },
    });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(getManagedTextWorkflowState(context)?.serverId).toBe(workflowId);
  });
});
