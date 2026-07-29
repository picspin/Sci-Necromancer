import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginManagedTextWorkflow,
  completeManagedTextWorkflow,
  acquireManagedTextCall,
  registerManagedTextWorkflow,
} from './managedTextWorkflow';

describe('managed text workflow', () => {
  beforeEach(() => completeManagedTextWorkflow());

  it('reuses one billing key from analysis through generation', () => {
    const analysisKey = beginManagedTextWorkflow('ISMRM:source-a');
    const analysis = acquireManagedTextCall('analysis', 'ISMRM:source-a');
    registerManagedTextWorkflow('ISMRM:source-a', analysisKey, 'server-task-1');
    const generation = acquireManagedTextCall('generation', 'ISMRM:source-a');

    expect(analysis).toEqual({
      idempotencyKey: analysisKey,
      operation: 'analysis',
      workflowId: undefined,
    });
    expect(generation.idempotencyKey).toBe(analysisKey);
  });

  it('uses a new single-call key after the workflow completes', () => {
    const workflowKey = beginManagedTextWorkflow('source-a');
    completeManagedTextWorkflow(workflowKey);

    const next = acquireManagedTextCall('generation', 'source-a');
    expect(next.operation).toBe('regeneration');
    expect(next.idempotencyKey).not.toBe(workflowKey);
  });

  it('marks a standalone deep update explicitly', () => {
    expect(acquireManagedTextCall('generation', 'source-a', 'deep_update').operation).toBe(
      'deep_update'
    );
  });

  it('does not cross-wire concurrent document contexts', () => {
    const first = beginManagedTextWorkflow('ISMRM:source-a');
    const second = beginManagedTextWorkflow('RSNA:source-b');
    registerManagedTextWorkflow('ISMRM:source-a', first, 'server-a');
    registerManagedTextWorkflow('RSNA:source-b', second, 'server-b');
    expect(acquireManagedTextCall('generation', 'ISMRM:source-a').workflowId).toBe('server-a');
    expect(acquireManagedTextCall('generation', 'RSNA:source-b').workflowId).toBe('server-b');
  });
});
