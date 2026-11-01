/** Executable single-chart catalog shared by planning, routing and the browser renderer. */
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
export type FigureTemplate = keyof typeof FIGURE_TEMPLATES;
export const FIGURE_STYLES = {
  standard: 'standard-v1',
  lancet: 'lancet-inspired-v1',
  nature: 'nature-inspired-v1',
  cell: 'cell-inspired-v1',
  nejm: 'nejm-inspired-v1',
} as const;
export type FigureStyle = keyof typeof FIGURE_STYLES;
export const FIGURE_TEMPLATE_INPUTS: Record<
  FigureTemplate,
  {
    required: string[];
    optional: string[];
    units: string[];
    options?: string;
  }
> = {
  'grouped-bar': { required: ['category', 'value'], optional: ['group'], units: ['value'] },
  scatter: { required: ['x', 'y'], optional: ['group'], units: ['x', 'y'] },
  heatmap: { required: ['row', 'column', 'value'], optional: [], units: ['value'] },
  trend: { required: ['x', 'value'], optional: ['series'], units: ['x', 'value'] },
  'dot-interval': {
    required: ['label', 'estimate', 'lower', 'upper'],
    optional: [],
    units: ['value'],
    options: '{"interval":{"type":"CI","ci_level":95}}',
  },
  forest: {
    required: ['label', 'estimate', 'lower', 'upper'],
    optional: [],
    units: ['value'],
    options: '{"interval":{"type":"CI","ci_level":95,"effect_type":"OR"}}',
  },
  'ranked-lollipop': {
    required: ['label', 'value'],
    optional: ['group'],
    units: ['value'],
    options: '{"ranking":{"ordering":"source","top_n":10}}',
  },
  composition: {
    required: ['group', 'component', 'count', 'denominator'],
    optional: [],
    units: ['count'],
    options:
      '{"composition":{"display":"count","denominator_scope":"within-group","mutually_exclusive":true,"exhaustive":true}}',
  },
  volcano: {
    required: ['identifier', 'log2fc', 'p'],
    optional: [],
    units: ['log2fc', 'p'],
    options: '{"volcano":{"p_kind":"adjusted_p","p_threshold":0.05,"fold_threshold":1}}',
  },
  distribution: { required: ['value'], optional: ['group'], units: ['value'] },
  radar: {
    required: ['method', 'metric', 'value'],
    optional: [],
    units: [],
    options: '{"radar":{"axes":[]}}',
  },
};

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
export const DATA_CHART_TEMPLATE_IDS = Object.keys(FIGURE_TEMPLATES) as FigureTemplate[];
export const DATA_FIGURE_ROUTING_VERSION = 'jev-data-figure-routing-v2' as const;
// Existing quota/cache RPC policy; distinct from the data recommendation wire format.
export const FIGURE_ROUTING_POLICY_VERSION = 'jev-figure-routing-v1' as const;

/** Observable capabilities, not promises to compute absent statistics or fit new models. */
export const DATA_CHART_CRITERIA: Record<FigureTemplate, string> = {
  'grouped-bar': 'Compare supplied numeric values across categories, optionally across groups.',
  scatter:
    'Show associations between two supplied numeric fields, optionally grouped. No regression fitting.',
  heatmap:
    'Show supplied numeric values across row and column categories; no inferred matrix values.',
  trend:
    'Show supplied numeric values along an ordered numeric x axis, optionally multiple series. Time must already be numeric with declared units; no date parsing, smoothing or accumulation.',
  'dot-interval':
    'Show supplied estimates with explicit lower and upper interval bounds and labels.',
  forest:
    'Show supplied effect estimates with explicit lower/upper bounds, labels and declared effect type.',
  'ranked-lollipop': 'Rank supplied numeric values by labeled entities, optionally grouped.',
  composition:
    'Show supplied component counts with explicit group denominators and composition assumptions.',
  volcano:
    'Show supplied identifiers, log2 fold changes and p-values with declared p-value type/thresholds.',
  distribution:
    'Show a box/scatter distribution or explicitly configured histogram of numeric observations, optionally grouped. No violin or density fitting.',
  radar:
    'Compare methods across explicitly normalized, bounded metric axes with supplied directions and units. Do not invent comparable scales.',
};

export interface DataFigureRecommendations {
  candidates: Array<{ templateId: FigureTemplate; suitability: number }>;
  policyVersion: typeof FIGURE_ROUTING_POLICY_VERSION;
  contractVersion: typeof DATA_FIGURE_ROUTING_VERSION;
  provider: 'typesafe';
  model: 'jev-1.13.0';
}

/** Fail closed for both cached JSON and client responses; no unknown IDs or extra payload. */
export function isDataFigureRecommendations(value: unknown): value is DataFigureRecommendations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).length !== 5 ||
    Object.keys(result).some(
      (k) => !['candidates', 'policyVersion', 'contractVersion', 'provider', 'model'].includes(k)
    ) ||
    result.policyVersion !== FIGURE_ROUTING_POLICY_VERSION ||
    result.contractVersion !== DATA_FIGURE_ROUTING_VERSION ||
    result.provider !== 'typesafe' ||
    result.model !== 'jev-1.13.0' ||
    !Array.isArray(result.candidates) ||
    result.candidates.length > DATA_CHART_TEMPLATE_IDS.length
  )
    return false;
  const seen = new Set<string>();
  let previous = 1;
  for (const candidate of result.candidates) {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate) ||
      Object.keys(candidate).length !== 2 ||
      typeof candidate.templateId !== 'string' ||
      !Object.prototype.hasOwnProperty.call(FIGURE_TEMPLATES, candidate.templateId) ||
      typeof candidate.suitability !== 'number' ||
      !Number.isFinite(candidate.suitability) ||
      candidate.suitability <= 0.8 ||
      candidate.suitability > previous ||
      seen.has(candidate.templateId)
    )
      return false;
    seen.add(candidate.templateId);
    previous = candidate.suitability;
  }
  return true;
}
