import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createJevVersionStore, type JevPostCheckVersion } from './versionStore';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TASK_ID = '550e8400-e29b-41d4-a716-446655440001';
const VERSION_ID = '550e8400-e29b-41d4-a716-446655440002';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

function input(): JevPostCheckVersion {
  const draftText = 'draft abstract';
  const finalText = 'final abstract';
  return {
    id: VERSION_ID,
    taskId: TASK_ID,
    operation: 'generation',
    userId: USER_ID,
    sourceHash: 'a'.repeat(64),
    draftText,
    finalText,
    draftHash: sha(draftText),
    finalHash: sha(finalText),
    conference: 'ISMRM',
    generationModels: ['glm-5.2'],
    generationCalls: [{ stage: 'draft', provider: 'mga', model: 'glm-5.2' }],
    initialCheck: { status: 'check_complete' },
    finalCheck: { status: 'check_complete' },
    status: 'check_complete',
  };
}

describe('Jev generation version store', () => {
  it('persists an owner-scoped immutable version through the service RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { id: VERSION_ID }, error: null }) };
    await expect(createJevVersionStore(client).persistVersion(input())).resolves.toMatchObject({
      id: VERSION_ID,
      taskId: TASK_ID,
    });
    expect(client.rpc).toHaveBeenCalledWith(
      'jev_persist_generation_version',
      expect.objectContaining({
        p_user_id: USER_ID,
        p_version_id: VERSION_ID,
        p_task_id: TASK_ID,
        p_source_hash: 'a'.repeat(64),
        p_draft_text: 'draft abstract',
        p_final_text: 'final abstract',
      })
    );
  });

  it('rejects source-text/hash tampering before any write', async () => {
    const client = { rpc: vi.fn() };
    await expect(
      createJevVersionStore(client).persistVersion({ ...input(), draftHash: 'b'.repeat(64) })
    ).rejects.toThrow('invalid_jev_generation_version');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('maps duplicate and missing workflow errors without leaking database details', async () => {
    for (const [message, code] of [
      ['jev_generation_version_exists', 'jev_generation_version_exists'],
      ['jev_generation_workflow_not_found', 'jev_generation_workflow_not_found'],
    ]) {
      const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message } }) };
      await expect(createJevVersionStore(client).persistVersion(input())).rejects.toThrow(code);
    }
  });

  it('lists only validated rows through the scoped service RPC', async () => {
    const row = {
      id: TASK_ID,
      task_id: TASK_ID,
      user_id: USER_ID,
      operation: 'deep_update',
      source_hash: 'a'.repeat(64),
      draft_text: 'draft abstract',
      final_text: 'final abstract',
      draft_hash: sha('draft abstract'),
      final_hash: sha('final abstract'),
      conference: 'RSNA',
      generation_models: ['glm-5.2', 'gpt-5.6-luna'],
      generation_calls: [
        { stage: 'draft', provider: 'mga', model: 'glm-5.2' },
        { stage: 'revision', provider: 'mga', model: 'gpt-5.6-luna' },
      ],
      initial_check: null,
      final_check: { status: 'needs_author_review' },
      status: 'needs_author_review',
      unavailable_reason: null,
      created_at: '2026-09-24T00:00:00Z',
    };
    const client = { rpc: vi.fn().mockResolvedValue({ data: [row], error: null }) };
    await expect(createJevVersionStore(client).listVersions(USER_ID, 10)).resolves.toEqual([
      expect.objectContaining({ taskId: TASK_ID, operation: 'deep_update' }),
    ]);
    expect(client.rpc).toHaveBeenCalledWith('jev_list_generation_versions', {
      p_user_id: USER_ID,
      p_limit: 10,
    });
  });

  it('bounds query limits and stored model count', async () => {
    const client = { rpc: vi.fn() };
    await expect(createJevVersionStore(client).listVersions(USER_ID, 0)).rejects.toThrow(
      'invalid_jev_generation_version_query'
    );
    await expect(
      createJevVersionStore(client).persistVersion({
        ...input(),
        generationModels: ['a', 'b', 'c', 'd', 'e'],
      })
    ).rejects.toThrow('invalid_jev_generation_version');
  });
});
