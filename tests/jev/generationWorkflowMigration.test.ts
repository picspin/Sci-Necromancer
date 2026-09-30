import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/202609240001_jev_generation_workflow.sql',
  'utf8'
);

describe('Jev generation workflow migration (static contract, not a PostgreSQL transaction test)', () => {
  it('binds the task to source hash, conference and first-generation model', () => {
    for (const column of [
      'jev_cache_key',
      'jev_source_hash',
      'jev_conference',
      'jev_locked_model',
    ]) {
      expect(migration).toContain(`add column if not exists ${column} text`);
    }
    expect(migration).toContain('v_task.jev_source_hash is distinct from p_source_hash');
    expect(migration).toContain('v_task.jev_conference is distinct from p_conference');
    expect(migration).toContain('v_task.jev_locked_model is distinct from p_locked_model');
    expect(migration).toContain(
      'v_task.generation_count = 0 and p_model is distinct from v_task.jev_locked_model'
    );
  });

  it('uses service-only RPCs and does not debit the member during Jev analysis', () => {
    expect(migration).toContain('from public.member_profiles');
    expect(migration).toContain('for update');
    expect(migration).toContain('where user_id = p_user_id');
    expect(migration).toContain('credit_cost, call_count, successful_call_count');
    expect(migration).toContain('0, 1, 1');
    expect(migration).not.toContain('insert into public.bonus_ledger');
    expect(migration).not.toContain('bonus_balance = bonus_balance -');
    for (const fn of ['jev_open_generation_workflow', 'jev_assert_generation_context']) {
      expect(migration).toContain(`function public.${fn}`);
    }
    expect(migration).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function[\s\S]*to service_role/);
  });
});
