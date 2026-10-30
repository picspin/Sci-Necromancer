import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import runtimeConfig from '../lib/figure/browserRuntime.json';
// @ts-expect-error Build-time ESM script, no production declaration needed.
import { plottingPackages } from './prepare-figure-runtime.mjs';

describe('pinned plotting assets', () => {
  it('pins every executable/core asset, not just the Python package lock', () => {
    const core = runtimeConfig.core;
    expect(core).toBeDefined();
    expect(Object.keys(core).sort()).toEqual(
      ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip'].sort()
    );
    for (const [name, hash] of Object.entries(core)) {
      expect(
        createHash('sha256')
          .update(readFileSync(`${process.cwd()}/node_modules/pyodide/${name}`))
          .digest('hex')
      ).toBe(hash);
    }
  });
  it('includes only the transitive plotting dependencies, once each', () => {
    const pkg = (name: string, depends: string[]) => ({
      name,
      depends,
      file_name: `${name}.whl`,
      sha256: 'a'.repeat(64),
    });
    expect(
      plottingPackages({
        packages: {
          matplotlib: pkg('matplotlib', ['numpy', 'pillow']),
          numpy: pkg('numpy', []),
          pillow: pkg('pillow', ['numpy']),
          unused: pkg('unused', []),
        },
      }).map((p: { name: string }) => p.name)
    ).toEqual(['matplotlib', 'numpy', 'pillow']);
  });
  it('rejects package paths, missing dependencies and unpinned digests', () => {
    for (const file_name of ['../escape.whl', 'https://other.test/package.whl']) {
      expect(() =>
        plottingPackages({
          packages: { matplotlib: { file_name, sha256: 'a'.repeat(64), depends: [] } },
        })
      ).toThrow();
    }
    expect(() => plottingPackages({ packages: {} })).toThrow();
  });
});
