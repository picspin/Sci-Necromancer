import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const helpCatalogSource = readFileSync(resolve(process.cwd(), 'lib/help/helpCatalog.ts'), 'utf8');

describe('serverless ESM import contract', () => {
  it('loads every emitted API entrypoint in plain Node without Vite alias resolution', () => {
    const root = process.cwd();
    const entrypoints = readdirSync(resolve(root, 'api'), { recursive: true })
      .map(String)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map((file) => resolve(root, 'api', file));
    // Keep external package resolution pointed at this checkout's node_modules.
    const output = mkdtempSync(resolve(root, 'node_modules/.serverless-import-'));
    try {
      const program = ts.createProgram(entrypoints, {
        rootDir: root,
        outDir: output,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: root,
        paths: { '@/*': ['./*'] },
        resolveJsonModule: true,
        esModuleInterop: true,
        skipLibCheck: true,
      });
      expect(program.emit().emitSkipped).toBe(false);
      const urls = entrypoints.map(
        (file) => pathToFileURL(file.replace(root, output).replace(/\.ts$/, '.js')).href
      );
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `
          import assert from 'node:assert/strict';
          for (const url of ${JSON.stringify(urls)}) {
            const entrypoint = await import(url);
            assert.equal(typeof entrypoint.default, 'function', url);
          }
        `,
        ],
        { timeout: 30_000, stdio: 'pipe' }
      );
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  }, 45_000);

  it('declares JSON import attributes for the help catalog loaded by api/generate', () => {
    const jsonImports = helpCatalogSource
      .split('\n')
      .filter((line) => /^import .+\.json['"]/.test(line));

    expect(jsonImports).toHaveLength(4);
    expect(jsonImports.every((line) => /with\s*\{\s*type:\s*['"]json['"]\s*\}/.test(line))).toBe(
      true
    );
  });

  it('uses explicit JavaScript extensions for relative runtime modules', () => {
    const relativeRuntimeImports = helpCatalogSource
      .split('\n')
      .filter((line) => /^import .+ from ['"]\.\.?\//.test(line))
      .filter((line) => !/\.json['"]/.test(line));

    expect(relativeRuntimeImports.length).toBeGreaterThan(0);
    expect(relativeRuntimeImports.every((line) => /\.js['"]/.test(line))).toBe(true);
  });
});
