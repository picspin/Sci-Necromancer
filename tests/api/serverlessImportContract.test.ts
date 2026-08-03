import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const helpCatalogSource = readFileSync(resolve(process.cwd(), 'lib/help/helpCatalog.ts'), 'utf8');

describe('serverless ESM import contract', () => {
  it('declares JSON import attributes for the help catalog loaded by api/generate', () => {
    const jsonImports = helpCatalogSource
      .split('\n')
      .filter((line) => /^import .+\.json['"]/.test(line));

    expect(jsonImports).toHaveLength(4);
    expect(jsonImports.every((line) => /with\s*\{\s*type:\s*['"]json['"]\s*\}/.test(line))).toBe(
      true
    );
  });
});
