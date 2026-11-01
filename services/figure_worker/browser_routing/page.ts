// Synthetic transport boundary only: no network fetch, real member, wallet or model calls.
import { computed, createApp, h, ref } from 'vue';
import { createI18n } from 'vue-i18n';
import DataFigureRouting from '../../../src/components/panels/ImageGenerationPanel/DataFigureRouting.vue';
import { createMemberApiClient } from '../../../src/services/memberApiClient';
import type { DataFigureRoutingInput } from '../../../backend/_jev/figureRouting';
import { DATA_FIGURE_ROUTING_VERSION } from '../../../lib/figure/dataFigureTemplates';
if (!import.meta.env.DEV) throw new Error('Development-only harness');
const scenario = ref('multiple'),
  allowed = ref(true),
  context = ref('synthetic-member-1'),
  dataset = ref(1),
  selected = ref('none');
const requests = ref<string[]>([]);
const profile = computed(() => ({
  dataset_sha256: String(dataset.value).repeat(64),
  row_count: 3,
  byte_count: 50,
  columns: [
    { id: 'col_1', name: 'PRIVATE_NAME', kind: 'text', missing_count: 0 },
    { id: 'col_2', name: 'PRIVATE_VALUE', kind: 'numeric', missing_count: 0 },
  ],
}));
const client = createMemberApiClient({
  baseUrl: 'https://synthetic.invalid',
  getAccessToken: async () => 'synthetic-not-a-session',
  fetcher: async (_url, init) => {
    requests.value.push(String(init?.body));
    const current = scenario.value;
    // Intentionally ignores abort to verify the component's stale-response guard as well.
    await new Promise((resolve) => setTimeout(resolve, current === 'delayed' ? 1200 : 100));
    const status = /^\d+$/.test(current) ? Number(current) : 200;
    const candidates =
      current === 'none'
        ? []
        : current === 'malformed'
          ? [{ templateId: 'roc-pr', suitability: 0.99 }]
          : [
              { templateId: 'scatter', suitability: 0.93 },
              { templateId: 'trend', suitability: 0.91 },
            ];
    return new Response(
      JSON.stringify(
        status === 200
          ? {
              kind: 'data-template',
              decision: {
                candidates,
                policyVersion: 'jev-figure-routing-v1',
                contractVersion: DATA_FIGURE_ROUTING_VERSION,
                provider: 'typesafe',
                model: 'jev-1.13.0',
              },
              cached: false,
              remaining: 29,
            }
          : { error: 'synthetic_error' }
      ),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  },
});
async function request(input: DataFigureRoutingInput, signal: AbortSignal) {
  return (await client.figureRoute({ kind: 'data-template', input }, signal)).decision;
}
createApp({
  setup: () => () =>
    h('main', [
      h('h1', 'Synthetic routing contract verification'),
      h(
        'p',
        'Development only. Mock responses validate interactions, not Jev quality. No external API, member session, wallet or raw data upload.'
      ),
      h('h2', 'Local interaction checks'),
      h('label', [
        'Scenario ',
        h(
          'select',
          {
            'aria-label': 'Scenario',
            value: scenario.value,
            onChange: (event: Event) => {
              scenario.value = (event.target as HTMLSelectElement).value;
            },
          },
          [
            'multiple',
            'none',
            'delayed',
            'malformed',
            '202',
            '401',
            '402',
            '403',
            '404',
            '429',
            '503',
          ].map((value) => h('option', { value }, value))
        ),
      ]),
      h(
        'button',
        {
          onClick: () => {
            allowed.value = !allowed.value;
          },
        },
        'Toggle access'
      ),
      h(
        'button',
        {
          onClick: () => {
            dataset.value++;
          },
        },
        'Change dataset'
      ),
      h(
        'button',
        {
          onClick: () => {
            context.value += '-new';
          },
        },
        'Change identity'
      ),
      h(DataFigureRouting, {
        profile: profile.value,
        canRequest: allowed.value,
        contextKey: context.value,
        request,
        onSelect: (value: string) => {
          selected.value = value;
        },
        onInvalidate: () => {
          selected.value = 'none';
        },
        onManual: () => {
          selected.value = 'manual';
        },
      }),
      h('p', { 'aria-label': 'Selection' }, selected.value),
      h(
        'pre',
        { 'aria-label': 'Recorded requests' },
        JSON.stringify(
          requests.value.map((value) => JSON.parse(value)),
          null,
          2
        )
      ),
    ]),
})
  .use(createI18n({ legacy: false, locale: 'en', messages: {} }))
  .mount('#app');
