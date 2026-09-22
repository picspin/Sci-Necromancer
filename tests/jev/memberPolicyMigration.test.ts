import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/202609220001_jev_member_policy.sql', 'utf8');

describe('Jev member policy migration (static contract only; not transaction semantics)', () => {
  it('creates private RLS tables and service-only entry points', () => {
    for (const table of [
      'member_jev_consents',
      'member_jev_analysis_attempts',
      'member_jev_analysis_cache',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toMatch(/revoke all on table[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/grant all on table[\s\S]*to service_role/);
    for (const fn of [
      'jev_get_consent',
      'jev_set_consent',
      'jev_reserve_analysis',
      'jev_settle_analysis',
      'jev_prune_expired_analysis',
    ]) {
      expect(migration).toContain(`function public.${fn}`);
    }
    expect(migration).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function[\s\S]*to service_role/);
  });

  it('uses profile locking, database clock, bounded cache and no ledger mutation', () => {
    expect(
      migration.match(/from public\.member_profiles where user_id[^;]*for update/g)?.length
    ).toBeGreaterThanOrEqual(4);
    expect(migration).toContain('clock_timestamp()');
    expect(migration).toContain("interval '120 seconds'");
    expect(migration).toContain("interval '24 hours'");
    expect(migration).toContain("interval '48 hours'");
    expect(migration).toContain("octet_length(convert_to(p_result::text,'utf8'))>65536");
    expect(migration).not.toMatch(/member_credit_ledger|insert into public\.member_.*ledger/i);
  });

  it('has atomic quota, cache, consent-revocation and terminal-outcome clauses', () => {
    expect(migration).toContain("created_at>v_now-interval '1 minute'");
    expect(migration).toContain("status in ('pending','completed')");
    expect(migration).toContain(
      'delete from public.member_jev_analysis_cache where user_id=p_user_id'
    );
    expect(migration).toContain("set status='failed' where user_id=p_user_id and status='pending'");
    expect(migration).toContain("return jsonb_build_object('status','expired')");
    expect(migration).toContain("return jsonb_build_object('status','conflict')");
    expect(migration).toContain(
      "p_result - array['analysis','preflight','provider','model','policyVersion']"
    );
    expect(migration).toContain(
      "p_result ?| array['sourceText','source_text','prompt','evidence','manuscript','text']"
    );
    expect(migration).toContain('select user_id from (');
  });
});
