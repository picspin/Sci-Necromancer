<template>
  <main>
    <h1>Figure planning contract · mock only</h1>
    <p>
      Fixed synthetic fixtures. No real LLM, Jev, member, wallet or external API calls. Not a
      production entry or a model-quality evaluation.
    </p>
    <div class="grid">
      <section aria-label="Planning input">
        <h2>1 · Approve metadata</h2>
        <label
          >Fixture<select v-model="index">
            <option v-for="(item, n) in planningFixtures" :key="item.templateId" :value="n">
              {{ item.templateId }}
            </option>
          </select></label
        >
        <label
          >Scenario<select v-model="scenario">
            <option v-for="name in scenarios" :key="name">{{ name }}</option>
          </select></label
        >
        <label
          >Journal-inspired style<select v-model="style">
            <option v-for="(_, id) in FIGURE_STYLES" :key="id" :value="id">{{ id }}</option>
          </select></label
        >
        <label>Figure goal<textarea v-model="goal" rows="3" maxlength="1000" /></label>
        <details>
          <summary>Local synthetic CSV · never in model request</summary>
          <pre aria-label="Local fixture CSV">{{ fixture.csv }}</pre>
        </details>
        <pre aria-label="Metadata preview">{{ JSON.stringify(input, null, 2) }}</pre>
        <label class="check"
          ><input v-model="approved" type="checkbox" :disabled="busy" />Approve displayed metadata
          (mock only)</label
        >
        <button type="button" :disabled="!approved || busy" @click="plan">Build mock plan</button>
        <button v-if="busy" type="button" @click="reset">Cancel work</button>
        <p v-if="busy" role="status">Working locally… {{ stage }}</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <p v-if="result?.status === 'needs_input'" role="status">
          Needs input: {{ result.missing.join(', ') }}
        </p>
        <details v-if="request">
          <summary>Approved request</summary>
          <pre aria-label="Approved planning request">{{ JSON.stringify(request, null, 2) }}</pre>
        </details>
      </section>
      <section aria-label="Frozen plan and preview">
        <h2>2 · Confirm and validate locally</h2>
        <pre v-if="result?.status === 'draft'" aria-label="Frozen planning draft">{{
          JSON.stringify(result.spec, null, 2)
        }}</pre>
        <label class="check"
          ><input
            v-model="confirmed"
            type="checkbox"
            :disabled="result?.status !== 'draft' || busy"
          />Confirm frozen plan for local rendering</label
        >
        <button
          type="button"
          :disabled="!confirmed || result?.status !== 'draft' || busy"
          @click="render"
        >
          Render confirmed plan
        </button>
        <p>
          The trusted Python renderer checks the actual CSV. A draft is not statistical validation
          or a paid member receipt. Preview has a hidden marker; original exports remain
          unauthorized.
        </p>
        <img
          v-if="preview"
          :src="`data:image/png;base64,${preview.preview}`"
          alt="Planned figure preview"
        />
        <pre v-if="preview" aria-label="Render manifest">{{
          JSON.stringify(preview.manifest, null, 2)
        }}</pre>
      </section>
    </div>
  </main>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  BrowserFigureSession,
  type BrowserFigurePreview,
} from '../../../src/services/browserFigures';
import {
  buildFigurePlanningRequest,
  parseFigurePlanningResponse,
  type FigurePlanningInput,
  type FigurePlanningResult,
} from '../../../lib/figure/figurePlanning';
import { planningFixtures } from './fixtures';
import { FIGURE_STYLES, type FigureStyle } from '../../../lib/figure/dataFigureTemplates';
const scenarios = [
  'ready',
  'missing-unit',
  'missing-options',
  'injected',
  'unknown-column',
  'delayed',
];
const index = ref(0),
  scenario = ref('ready'),
  goal = ref(planningFixtures[0].input.goal);
const style = ref<FigureStyle>('nature'),
  stage = ref('');
const approved = ref(false),
  confirmed = ref(false),
  busy = ref(false),
  error = ref('');
const request = ref<ReturnType<typeof buildFigurePlanningRequest> | null>(null);
const result = ref<FigurePlanningResult | null>(null),
  preview = ref<BrowserFigurePreview | null>(null);
const fixture = computed(() => planningFixtures[index.value]);
const input = computed(() => {
  const snapshot = JSON.parse(JSON.stringify(fixture.value.input)) as FigurePlanningInput;
  snapshot.goal = goal.value;
  snapshot.styleId = style.value;
  if (scenario.value === 'missing-unit') snapshot.fields.forEach((field) => delete field.unit);
  if (scenario.value === 'missing-options') delete snapshot.parameters;
  return snapshot;
});
const session = new BrowserFigureSession();
let epoch = 0,
  payload: Uint8Array | null = null;
function reset() {
  ++epoch;
  session.dispose();
  payload = null;
  approved.value = false;
  confirmed.value = false;
  busy.value = false;
  result.value = null;
  preview.value = null;
  request.value = null;
  error.value = '';
  stage.value = '';
}
watch(
  index,
  () => {
    goal.value = fixture.value.input.goal;
  },
  { flush: 'sync' }
);
watch([index, scenario, goal, style], reset, { flush: 'sync' });
async function plan() {
  if (!approved.value || busy.value) return;
  const run = ++epoch,
    snapshot = JSON.parse(JSON.stringify(input.value)) as FigurePlanningInput;
  const sample = fixture.value,
    mode = scenario.value;
  busy.value = true;
  confirmed.value = false;
  error.value = '';
  result.value = null;
  preview.value = null;
  try {
    request.value = buildFigurePlanningRequest(snapshot);
    const bytes = new TextEncoder().encode(sample.csv);
    stage.value = 'inspecting';
    const profile = await session.inspect(bytes);
    if (run !== epoch) return;
    // Explicit synthetic transport deliberately ignores cancellation, testing the epoch guard.
    stage.value = 'mock-pending';
    await new Promise((resolve) => setTimeout(resolve, mode === 'delayed' ? 1200 : 10));
    if (run !== epoch) return;
    const mapping = { ...sample.mapping };
    if (mode === 'unknown-column') mapping[Object.keys(mapping)[0]] = 'col_99';
    const reply = JSON.stringify({
      status: 'ready',
      mapping,
      ...(mode === 'injected' ? { python: 'not executed' } : {}),
    });
    result.value = parseFigurePlanningResponse(reply, snapshot, profile.dataset_sha256);
    payload = bytes;
  } catch (e) {
    if (run === epoch) error.value = e instanceof Error ? e.message : 'planning_failed';
  } finally {
    if (run === epoch) busy.value = false;
  }
}
async function render() {
  if (!confirmed.value || result.value?.status !== 'draft' || !payload || busy.value) return;
  const run = ++epoch,
    spec = JSON.parse(JSON.stringify(result.value.spec));
  busy.value = true;
  stage.value = 'rendering';
  error.value = '';
  preview.value = null;
  try {
    const rendered = await session.render(payload, spec);
    if (run === epoch) preview.value = rendered;
  } catch (e) {
    if (run === epoch) error.value = e instanceof Error ? e.message : 'render_failed';
  } finally {
    if (run === epoch) busy.value = false;
  }
}
onBeforeUnmount(reset);
</script>
