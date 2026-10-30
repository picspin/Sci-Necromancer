export const FIGURE_TEMPLATES = {
  'grouped-bar': 'grouped-bar-v1',
  scatter: 'scatter-v1',
  heatmap: 'heatmap-v1',
  trend: 'trend-v1',
  'dot-interval': 'dot-interval-v1',
  forest: 'forest-v1',
  'ranked-lollipop': 'ranked-lollipop-v1',
  composition: 'composition-v1',
  volcano: 'volcano-v1',
  distribution: 'distribution-box-scatter-v1',
  radar: 'radar-explicit-axes-v1',
} as const;
export const FIGURE_STYLES = {
  standard: 'standard-v1',
  lancet: 'lancet-inspired-v1',
  nature: 'nature-inspired-v1',
  cell: 'cell-inspired-v1',
  nejm: 'nejm-inspired-v1',
} as const;
export type FigureTemplate = keyof typeof FIGURE_TEMPLATES;
export type FigureStyle = keyof typeof FIGURE_STYLES;
export interface CsvProfile {
  dataset_sha256: string;
  row_count: number;
  byte_count: number;
  columns: Array<{ id: string; name: string; kind: string; missing_count: number }>;
}
export interface BrowserFigurePreview {
  preview: string;
  manifest: {
    width_px: number;
    height_px: number;
    dpi: number;
    pyodide_version: string;
    template_version: string;
    style_version: string;
    dataset_sha256: string;
    figure_spec_sha256: string;
    preview_sha256: string;
    runtime_dependencies: Record<string, string>;
    [key: string]: unknown;
  };
}

export function createFigureSpec(
  datasetHash: string,
  template: FigureTemplate,
  mapping: Record<string, string>,
  units: Record<string, string>,
  style: FigureStyle
): Record<string, unknown> {
  if (
    !/^[a-f0-9]{64}$/.test(datasetHash) ||
    !Object.prototype.hasOwnProperty.call(FIGURE_TEMPLATES, template) ||
    !Object.prototype.hasOwnProperty.call(FIGURE_STYLES, style)
  ) {
    throw new Error('invalid_figure_plan');
  }
  return {
    schema_version: 'figure-spec-v1',
    dataset_sha256: datasetHash,
    template_id: template,
    template_version: FIGURE_TEMPLATES[template],
    mapping: { ...mapping },
    units: { ...units },
    style: { id: style, version: FIGURE_STYLES[style] },
  };
}

// One Worker per active workspace. A timeout/cancel destroys its entire WASM heap.
export class BrowserFigureSession {
  private worker: Worker | null = null;
  private nextId = 0;
  private pending: {
    id: number;
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  constructor(
    private readonly createWorker: () => Worker = () =>
      new Worker(new URL('./browserFigures.worker.ts', import.meta.url), { type: 'module' })
  ) {}

  inspect(payload: Uint8Array): Promise<CsvProfile> {
    return this.request('inspect', payload) as Promise<CsvProfile>;
  }
  render(
    payload: Uint8Array,
    spec: Record<string, unknown>,
    onProgress?: (stage: string) => void
  ): Promise<BrowserFigurePreview> {
    return this.request('render', payload, spec, onProgress) as Promise<BrowserFigurePreview>;
  }
  private async request(
    type: 'inspect' | 'render',
    payload: Uint8Array,
    spec?: Record<string, unknown>,
    onProgress?: (stage: string) => void
  ): Promise<unknown> {
    if (!payload.byteLength || payload.byteLength > 10 * 1024 * 1024)
      throw new Error('invalid_csv_size');
    if (this.pending) throw new Error('figure_operation_pending');
    if (spec && JSON.stringify(spec).length > 64 * 1024) throw new Error('invalid_figure_plan');
    if (!this.worker) this.worker = this.createWorker();
    const worker = this.worker,
      id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.dispose('figure_timeout'), 120_000);
      this.pending = { id, resolve, reject, timer };
      worker.onmessage = ({ data }) => {
        if (!this.pending || this.pending.id !== id || data.id !== id || this.worker !== worker)
          return;
        if (data.type === 'progress') {
          onProgress?.(data.stage);
          return;
        }
        clearTimeout(timer);
        this.pending = null;
        if (data.type === 'result') resolve(data.result);
        else {
          this.dispose();
          reject(new Error(typeof data.code === 'string' ? data.code : 'figure_runtime_failed'));
        }
      };
      worker.onerror = () => {
        if (this.worker === worker) this.dispose('figure_runtime_failed');
      };
      try {
        worker.postMessage({ id, type, payload, spec });
      } catch {
        this.dispose('figure_runtime_failed');
      }
    });
  }
  dispose(reason = 'figure_cancelled') {
    this.worker?.terminate();
    this.worker = null;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error(reason));
      this.pending = null;
    }
  }
}
