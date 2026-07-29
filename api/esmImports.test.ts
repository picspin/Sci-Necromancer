import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_ROOT = join(process.cwd(), 'api');

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [path]
      : [];
  });
}

describe('Vercel Node ESM imports', () => {
  it('uses explicit runtime extensions for every relative production import', () => {
    const extensionlessImports = productionTypeScriptFiles(API_ROOT).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const imports = source.matchAll(/(?:from\s+|import\s*)['"](\.\.?\/[^'"]+)['"]/g);

      return [...imports].flatMap((match) =>
        extname(match[1]) ? [] : [`${relative(process.cwd(), file)}: ${match[1]}`]
      );
    });

    expect(extensionlessImports).toEqual([]);
  });
});
