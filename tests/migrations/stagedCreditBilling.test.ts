import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202608110001_staged_credit_billing.sql'),
  'utf8'
);

describe('staged member credit billing migration', () => {
  it('keeps two completed analyses free and charges repeated analysis from the third call', () => {
    expect(migration).toContain("when p_task_kind = 'analysis_generation' then 0");
    expect(migration).toContain('case when task.analysis_count >= 2 then 1 else 0 end');
    expect(migration).toContain("ledger_reason := 'analysis_retry'");
  });

  it('charges successful generation and deep update separately while preserving image cost', () => {
    expect(migration).toContain("when p_task_kind = 'image_generation' then 2");
    expect(migration).toContain("ledger_reason := 'generation'");
    expect(migration).toContain("ledger_reason := 'deep_update'");
    expect(migration).toContain('if task.generation_count >= 1');
    expect(migration).toContain('if task.deep_update_count >= 1');
  });

  it('returns the latest credit ledger entries in member status', () => {
    expect(migration).toContain("'credit_history', credit_history");
    expect(migration).toContain('from public.bonus_ledger');
    expect(migration).toContain('limit 50');
  });
});
