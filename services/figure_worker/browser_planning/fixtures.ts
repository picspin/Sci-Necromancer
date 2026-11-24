// Fixed, synthetic values only. Never used to infer or fill real user measurements.
import type { FigurePlanningInput } from '../../../lib/figure/figurePlanning';
import type { FigureTemplate } from '../../../lib/figure/dataFigureTemplates';

const definitions: Array<{
  templateId: FigureTemplate;
  csv: string;
  mapping: Record<string, string>;
  units: Record<string, string>;
  parameters?: Record<string, unknown>;
}> = [
  {
    templateId: 'grouped-bar',
    csv: 'Group,Value\nTreatment,12\nControl,9\n',
    mapping: { category: 'col_1', value: 'col_2' },
    units: { value: 'patients' },
  },
  {
    templateId: 'scatter',
    csv: 'X,Y\n1,2\n2,4\n',
    mapping: { x: 'col_1', y: 'col_2' },
    units: { x: 'mm', y: 'score' },
  },
  {
    templateId: 'heatmap',
    csv: 'R,C,V\nA,X,2\n',
    mapping: { row: 'col_1', column: 'col_2', value: 'col_3' },
    units: { value: 'score' },
  },
  {
    templateId: 'trend',
    csv: 'X,V\n1,3\n2,8\n',
    mapping: { x: 'col_1', value: 'col_2' },
    units: { x: 'weeks', value: 'patients' },
  },
  {
    templateId: 'dot-interval',
    csv: 'L,E,Low,High\nA,2,1,3\n',
    mapping: { label: 'col_1', estimate: 'col_2', lower: 'col_3', upper: 'col_4' },
    units: { value: 'score' },
    parameters: { interval: { type: 'CI', ci_level: 95 } },
  },
  {
    templateId: 'forest',
    csv: 'L,E,Low,High\nA,1.2,0.9,1.8\n',
    mapping: { label: 'col_1', estimate: 'col_2', lower: 'col_3', upper: 'col_4' },
    units: { value: 'OR' },
    parameters: { interval: { type: 'CI', ci_level: 95, effect_type: 'OR' } },
  },
  {
    templateId: 'ranked-lollipop',
    csv: 'L,V\nA,2\nB,5\n',
    mapping: { label: 'col_1', value: 'col_2' },
    units: { value: 'points' },
    parameters: { ranking: { ordering: 'descending', top_n: 2 } },
  },
  {
    templateId: 'composition',
    csv: 'G,C,N,D\nA,X,2,10\nA,Y,8,10\n',
    mapping: { group: 'col_1', component: 'col_2', count: 'col_3', denominator: 'col_4' },
    units: { count: 'patients' },
    parameters: {
      composition: {
        display: 'percent',
        denominator_scope: 'within-group',
        mutually_exclusive: true,
        exhaustive: true,
      },
    },
  },
  {
    templateId: 'volcano',
    csv: 'ID,FC,P\nA,-2,0.001\nB,2,0.1\n',
    mapping: { identifier: 'col_1', log2fc: 'col_2', p: 'col_3' },
    units: { log2fc: 'log2 fold change', p: 'probability' },
    parameters: { volcano: { p_kind: 'adjusted_p', p_threshold: 0.05, fold_threshold: 1 } },
  },
  {
    templateId: 'distribution',
    csv: 'V,G\n1,A\n4,A\n9,A\n',
    mapping: { value: 'col_1', group: 'col_2' },
    units: { value: 'score' },
  },
  {
    templateId: 'radar',
    csv: 'M,T,V\nA,AUC,0.75\nA,Time,25\nA,Error,-2\n',
    mapping: { method: 'col_1', metric: 'col_2', value: 'col_3' },
    units: {},
    parameters: {
      radar: {
        axes: [
          { metric: 'AUC', unit: 'ratio', lower: 0, upper: 1, direction: 'higher' },
          { metric: 'Time', unit: 'seconds', lower: 0, upper: 100, direction: 'lower' },
          { metric: 'Error', unit: 'mm', lower: -5, upper: 5, direction: 'lower' },
        ],
      },
    },
  },
];
const numericRoles = new Set([
  'x',
  'y',
  'value',
  'estimate',
  'lower',
  'upper',
  'count',
  'denominator',
  'log2fc',
  'p',
]);
export const planningFixtures = definitions.map((fixture) => ({
  ...fixture,
  input: {
    templateId: fixture.templateId,
    styleId: 'nature',
    goal: `Show the supplied synthetic ${fixture.templateId} observations without computing new statistics.`,
    fields: Object.entries(fixture.mapping).map(([role, id]) => {
      const unit =
        fixture.units[role] ??
        (['estimate', 'lower', 'upper'].includes(role)
          ? fixture.units.value
          : role === 'denominator'
            ? fixture.units.count
            : undefined);
      return {
        id,
        alias: role,
        type: numericRoles.has(role) ? 'continuous' : 'categorical',
        ...(unit ? { unit } : {}),
      };
    }),
    ...(fixture.parameters ? { parameters: fixture.parameters } : {}),
  } satisfies FigurePlanningInput,
}));
