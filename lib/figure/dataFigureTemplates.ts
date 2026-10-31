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
export const DATA_CHART_TEMPLATE_IDS = Object.keys(FIGURE_TEMPLATES) as FigureTemplate[];
export const DATA_FIGURE_ROUTING_VERSION = 'jev-data-figure-routing-v2' as const;

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
  policyVersion: typeof DATA_FIGURE_ROUTING_VERSION;
  provider: 'typesafe';
  model: 'jev-1.13.0';
}

/** Fail closed for both cached JSON and client responses; no unknown IDs or extra payload. */
export function isDataFigureRecommendations(value: unknown): value is DataFigureRecommendations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).length !== 4 ||
    Object.keys(result).some(
      (k) => !['candidates', 'policyVersion', 'provider', 'model'].includes(k)
    ) ||
    result.policyVersion !== DATA_FIGURE_ROUTING_VERSION ||
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
