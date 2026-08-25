import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearTextModelWorkflows,
  completeTextModelGeneration,
  getLockedTextModel,
  getTextWorkflowAssistance,
  lockTextModelForAnalysis,
  recordTextWorkflowAssistance,
} from './textModelWorkflow';
import { createAIAssistanceRecord } from '../compliance/aiDisclosure';

describe('text model workflow snapshots', () => {
  beforeEach(() => clearTextModelWorkflows());

  it('keeps one document model locked through generation and then releases it', () => {
    const glm = {
      source: 'managed' as const,
      provider: 'mga' as const,
      model: 'glm-5.2',
    };
    const luna = { ...glm, model: 'gpt-5.6-luna' };

    expect(lockTextModelForAnalysis('ER:paper-a', glm)).toEqual(glm);
    expect(lockTextModelForAnalysis('ER:paper-a', luna)).toEqual(glm);
    expect(lockTextModelForAnalysis('RSNA:paper-b', luna)).toEqual(luna);

    completeTextModelGeneration('ER:paper-a');

    expect(getLockedTextModel('ER:paper-a')).toBeNull();
    expect(getLockedTextModel('RSNA:paper-b')).toEqual(luna);
  });

  it('retains per-step assistance records until generation completes', () => {
    const record = createAIAssistanceRecord({
      provider: 'mga',
      model: 'glm-5.2',
      mode: 'standard',
      operations: ['content analysis'],
    });

    recordTextWorkflowAssistance('ER:paper-a', record);

    expect(getTextWorkflowAssistance('ER:paper-a')).toEqual([record]);
    completeTextModelGeneration('ER:paper-a');
    expect(getTextWorkflowAssistance('ER:paper-a')).toEqual([]);
  });
});
