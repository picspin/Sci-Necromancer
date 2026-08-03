import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202608030002_member_task_costs.sql'
);
const migration = readFileSync(migrationPath, 'utf8');

describe('member task-cost migration syntax guard', () => {
  it('avoids ambiguous CASE expressions at PL/pgSQL IF boundaries', () => {
    expect(migration).not.toMatch(/\b(?:elsif|if)\b[^\n]*<\s*case\b/i);
  });

  it('closes every dollar-quoted function body', () => {
    expect(migration.match(/\b(?:as|do)\s+\$\$/gi)).toHaveLength(
      migration.match(/\$\$;/g)?.length ?? 0
    );
  });
});
