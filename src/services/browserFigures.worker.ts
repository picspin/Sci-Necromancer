import type { PyodideInterface } from 'pyodide';
import dataset from '../../services/figure_worker/dataset.py?raw';
import render from '../../services/figure_worker/render.py?raw';
import styles from '../../services/figure_worker/styles.py?raw';
import spec from '../../services/figure_worker/spec.py?raw';
import multipanel from '../../services/figure_worker/multipanel.py?raw';
import bridge from '../../services/figure_worker/browser_runtime.py?raw';
import baselineLock from '../../services/figure_worker/uv.lock?raw';
import runtimeConfig from '../../lib/figure/browserRuntime.json';

const VERSION = runtimeConfig.version;
const WASM_LOCK_SHA256 = runtimeConfig.lockSha256;
let runtime: Promise<PyodideInterface> | null = null;
const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: unknown) => void;
  location: Location;
};

async function initialize(id: number) {
  const progress = (stage: string) => scope.postMessage({ id, type: 'progress', stage });
  progress('loading-runtime');
  const indexURL = new URL(`/runtime/pyodide/${VERSION}/`, scope.location.origin).href;
  const lockResponse = await fetch(`${indexURL}pyodide-lock.json`);
  if (!lockResponse.ok) throw new Error('figure_runtime_assets_missing');
  const lockBytes = await lockResponse.arrayBuffer();
  const lockHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', lockBytes)),
    (b) => b.toString(16).padStart(2, '0')
  ).join('');
  if (lockHash !== WASM_LOCK_SHA256) throw new Error('figure_runtime_integrity_failed');
  // Same-origin pinning catches mixed/stale deployments; it is not an independent
  // authentication boundary against an attacker controlling the application itself.
  await Promise.all(
    Object.entries(runtimeConfig.core).map(async ([name, expected]) => {
      const response = await fetch(`${indexURL}${name}`);
      if (!response.ok) throw new Error('figure_runtime_assets_missing');
      const bytes = await response.arrayBuffer();
      const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
        b.toString(16).padStart(2, '0')
      ).join('');
      if (actual !== expected) throw new Error('figure_runtime_integrity_failed');
    })
  );
  const { loadPyodide } = (await import(
    /* @vite-ignore */ `${indexURL}pyodide.mjs`
  )) as typeof import('pyodide');
  const py = await loadPyodide({
    indexURL,
    lockFileContents: new TextDecoder().decode(lockBytes),
    packageBaseUrl: indexURL,
    stdout: () => {},
    stderr: () => {},
  });
  if (py.version !== VERSION) throw new Error('figure_runtime_version_mismatch');
  progress('loading-matplotlib');
  await py.loadPackage('matplotlib', {
    checkIntegrity: true,
    messageCallback: () => {},
    errorCallback: () => {},
  });
  const directory = '/home/pyodide/services/figure_worker';
  py.FS.mkdirTree(directory);
  for (const [name, source] of Object.entries({
    'dataset.py': dataset,
    'render.py': render,
    'styles.py': styles,
    'spec.py': spec,
    'multipanel.py': multipanel,
    'browser_runtime.py': bridge,
    'uv.lock': baselineLock,
  })) {
    py.FS.writeFile(`${directory}/${name}`, source, { encoding: 'utf8' });
  }
  await py.runPythonAsync(`
import os, sys, json, base64
os.environ['MPLCONFIGDIR'] = '/tmp/sci-figure-matplotlib'
sys.path.insert(0, '/home/pyodide')
from pathlib import Path
from services.figure_worker.browser_runtime import inspect_csv, render_preview
from services.figure_worker.dataset import DatasetError

def _sci_request(request_json):
    request = json.loads(request_json)
    payload = Path('/tmp/sci-input.csv').read_bytes()
    try:
        if request['type'] == 'inspect':
            result = inspect_csv(payload)
        else:
            preview, manifest, artifacts = render_preview(payload, request['spec'])
            result = dict(preview=base64.b64encode(preview).decode('ascii'), manifest=manifest)
        return json.dumps(dict(ok=True, result=result), allow_nan=False)
    except DatasetError as error:
        return json.dumps(dict(ok=False, code=error.code))
`);
  return py;
}

scope.onmessage = async ({ data }) => {
  const { id, type, payload, spec } = data;
  if (
    !Number.isInteger(id) ||
    !['inspect', 'render'].includes(type) ||
    !(payload instanceof Uint8Array) ||
    !payload.length ||
    payload.length > 10 * 1024 * 1024
  ) {
    scope.postMessage({ id, type: 'error', code: 'invalid_csv_size' });
    return;
  }
  try {
    runtime ??= initialize(id);
    const py = await runtime;
    scope.postMessage({
      id,
      type: 'progress',
      stage: type === 'render' ? 'rendering' : 'inspecting',
    });
    py.FS.writeFile('/tmp/sci-input.csv', payload);
    py.globals.set('_sci_request_json', JSON.stringify({ type, spec }));
    const response = JSON.parse(await py.runPythonAsync('_sci_request(_sci_request_json)'));
    if (!response.ok) {
      scope.postMessage({ id, type: 'error', code: response.code });
      return;
    }
    if (type === 'render') {
      response.result.manifest.pyodide_version = py.version;
      response.result.manifest.pyodide_lock_sha256 = WASM_LOCK_SHA256;
    }
    scope.postMessage({ id, type: 'result', result: response.result });
  } catch {
    // No source rows, labels, provider secrets or Python traceback in telemetry.
    runtime = null;
    scope.postMessage({ id, type: 'error', code: 'figure_runtime_failed' });
  } finally {
    if (runtime) {
      const py = await runtime.catch(() => null);
      try {
        py?.FS.unlink('/tmp/sci-input.csv');
        py?.globals.delete('_sci_request_json');
      } catch {
        /* Disposed/failed initialization. */
      }
    }
  }
};
