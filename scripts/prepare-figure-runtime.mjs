// Build-time only downloads. User browsers load a fixed same-origin asset set.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import runtimeConfig from '../lib/figure/browserRuntime.json' with { type: 'json' };

const VERSION = runtimeConfig.version;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const core = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];
const MAX_BYTES = 25 * 1024 * 1024;

export function plottingPackages(lock) {
  const found = new Map();
  function visit(name) {
    if (found.has(name)) return;
    const pkg = lock.packages[name];
    if (
      !pkg ||
      !/^[a-zA-Z0-9_.-]+\.(whl|zip)$/.test(pkg.file_name) ||
      !/^[a-f0-9]{64}$/.test(pkg.sha256)
    ) {
      throw new Error(`Invalid pinned plotting package: ${name}`);
    }
    found.set(name, pkg);
    for (const dependency of pkg.depends) visit(dependency);
  }
  visit('matplotlib');
  return [...found.values()];
}

async function prepare() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = path.join(root, 'node_modules/pyodide');
  const destination = path.join(root, `public/runtime/pyodide/${VERSION}`);
  const pkg = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  if (pkg.version !== VERSION) throw new Error('Unexpected installed Pyodide version');
  const lockBytes = await readFile(path.join(source, 'pyodide-lock.json'));
  if (hash(lockBytes) !== runtimeConfig.lockSha256)
    throw new Error('Unexpected Pyodide package lock');
  const lock = JSON.parse(lockBytes.toString('utf8'));
  const checkOnly = process.argv.includes('--check');
  await mkdir(destination, { recursive: true });
  const files = {};
  for (const name of core) {
    const bytes = await readFile(path.join(source, name));
    const expected =
      name === 'pyodide-lock.json' ? runtimeConfig.lockSha256 : runtimeConfig.core[name];
    if (hash(bytes) !== expected) throw new Error(`Unexpected pinned runtime core: ${name}`);
    if (bytes.length > MAX_BYTES) throw new Error('Oversized runtime core asset');
    if (checkOnly) {
      if (hash(await readFile(path.join(destination, name))) !== hash(bytes))
        throw new Error(`Runtime core mismatch: ${name}`);
    } else await writeFile(path.join(destination, name), bytes);
    files[name] = { sha256: hash(bytes), bytes: bytes.length };
  }
  for (const pkg of plottingPackages(lock)) {
    const target = path.join(destination, pkg.file_name);
    let bytes;
    try {
      bytes = await readFile(target);
    } catch {
      /* First preparation. */
    }
    if (!bytes || hash(bytes) !== pkg.sha256) {
      if (checkOnly)
        throw new Error(
          `Missing or corrupt plotting asset: ${pkg.name}. Run npm run figures:prepare.`
        );
      const response = await fetch(
        `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/${pkg.file_name}`,
        {
          signal: AbortSignal.timeout(60_000),
          redirect: 'error',
        }
      );
      if (!response.ok) throw new Error(`Cannot prepare ${pkg.name}: HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > MAX_BYTES)
        throw new Error('Oversized plotting asset');
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_BYTES || hash(bytes) !== pkg.sha256)
        throw new Error(`Plotting asset integrity failed: ${pkg.name}`);
      await writeFile(target, bytes);
    }
    if (bytes.length > MAX_BYTES)
      throw new Error('Plotting asset exceeds Cloudflare static-file limit');
    files[pkg.file_name] = { sha256: pkg.sha256, bytes: bytes.length };
  }
  const manifest = JSON.stringify(
    {
      version: VERSION,
      packages: plottingPackages(lock).map((p) => ({ name: p.name, version: p.version })),
      files,
    },
    null,
    2
  );
  if (checkOnly) {
    if ((await readFile(path.join(destination, 'manifest.json'), 'utf8')) !== manifest)
      throw new Error('Stale runtime manifest');
  } else await writeFile(path.join(destination, 'manifest.json'), manifest);
  console.log(
    `Pyodide ${VERSION}: ${Object.keys(files).length} verified same-origin files, ${Object.values(files).reduce((n, f) => n + f.bytes, 0)} bytes.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await prepare();
}
