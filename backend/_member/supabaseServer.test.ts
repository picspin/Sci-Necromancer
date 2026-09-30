import { describe, expect, it, vi } from 'vitest';
import { createScopedMemberRpcClient } from './supabaseServer';

describe('scoped member RPC client', () => {
  it('never lets a caller override the authenticated user ID', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = createScopedMemberRpcClient({ rpc } as any, 'authenticated-user');
    await client.rpc('test_rpc', { p_user_id: 'attacker-user', p_limit: 10 });
    expect(rpc).toHaveBeenCalledWith('test_rpc', {
      p_user_id: 'authenticated-user',
      p_limit: 10,
    });
  });
});
