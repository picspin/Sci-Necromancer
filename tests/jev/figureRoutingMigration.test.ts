import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/202609260001_jev_figure_routing.sql', 'utf8');

describe('Jev figure routing migration (static contract only)', () => {
  it('stores only bounded routing metadata and hashes, never source rows or prompts', () => {
    expect(migration).toContain('create table public.member_jev_figure_routes');
    for (const field of ['user_id', 'kind', 'cache_key', 'status', 'result', 'lease_expires_at']) {
      expect(migration).toContain(field);
    }
    expect(migration).not.toMatch(/\b(source_text|prompt|patient_rows|raw_data)\s+(text|jsonb)/i);
    expect(migration).toContain("p_result ?| array['sourceText','prompt','patientRows','rawData']");
    expect(migration).toContain("octet_length(convert_to(p_result::text,'utf8'))>4096");
  });

  it('uses member-locked, consented, positive-balance, service-only reservations', () => {
    expect(migration).toContain('for update');
    expect(migration).toContain('member_jev_consents');
    expect(migration).toContain('coalesce(v_balance,0)<=0');
    expect(migration).toContain('v_minute>=3 or v_day>=30');
    expect(migration).toContain("interval '24 hours'");
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('jev_clear_figure_routes_on_revoke');
    expect(migration).toContain("'illustration-prompt'");
    expect(migration).toContain("'illustration-retry'");
  });
});
