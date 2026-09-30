import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/202609240002_jev_generation_versions.sql',
  'utf8'
);

describe('Jev generation versions migration (static contract only)', () => {
  it('stores bounded hashes, generated text and post-check snapshots without source text', () => {
    expect(migration).toContain('create table public.member_jev_generation_versions');
    for (const field of [
      'source_hash',
      'draft_text',
      'final_text',
      'draft_hash',
      'final_hash',
      'generation_models',
      'generation_calls',
      'initial_check',
      'final_check',
      'status',
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain('unique (task_id, operation)');
    expect(migration).toContain("octet_length(convert_to(draft_text, 'utf8')) <= 100000");
    expect(migration).toContain("octet_length(convert_to(final_check::text, 'utf8')) <= 65536");
    expect(migration).not.toMatch(/source_text|manuscript|p_prompt/i);
  });

  it('uses owner RLS reads and service-only mutation RPCs', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('using (user_id = auth.uid() and delivered)');
    expect(migration).toMatch(/revoke all on table[\s\S]*from public, anon/);
    expect(migration).toContain(
      'grant insert on table public.member_jev_generation_versions to service_role'
    );
    expect(migration).toContain('function public.jev_persist_generation_version');
    expect(migration).toContain('function public.jev_list_generation_versions');
    expect(migration).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function[\s\S]*to service_role/);
    expect(migration).toContain('p_version_id uuid');
    expect(migration).toContain('old.in_flight and not new.in_flight');
    expect(migration).toContain('new.successful_call_count > old.successful_call_count');
  });
});
