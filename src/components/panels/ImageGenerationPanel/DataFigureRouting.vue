<template>
  <section class="data-routing" :aria-label="copy.title">
    <h3>{{ copy.title }}</h3>
    <p>{{ copy.boundary }}</p>
    <p v-if="!canRequest" role="status">{{ copy.access }}</p>
    <p v-if="tooMany" role="status">{{ copy.limit }}</p>
    <fieldset :disabled="busy || locked || !profile || tooMany">
      <legend>{{ copy.metadata }}</legend>
      <p>{{ copy.privacy }}</p>
      <div v-for="(field, index) in fields" :key="index" class="metadata-field">
        <label
          >{{ copy.alias }} · {{ index + 1 }}<input v-model="field.alias" maxlength="120"
        /></label>
        <label
          >{{ copy.type }} · {{ index + 1
          }}<select v-model="field.type">
            <option v-for="kind in fieldTypes" :key="kind" :value="kind">{{ kind }}</option>
          </select></label
        >
        <label
          >{{ copy.unit }} · {{ index + 1 }}<input v-model="field.unit" maxlength="48"
        /></label>
      </div>
      <label>{{ copy.goal }}<textarea v-model="goal" rows="3" maxlength="1000" /></label>
      <details open>
        <summary>{{ copy.egress }}</summary>
        <pre>{{ JSON.stringify(input, null, 2) }}</pre>
      </details>
      <label class="approval"><input v-model="approved" type="checkbox" />{{ copy.approve }}</label>
    </fieldset>
    <div class="actions">
      <button
        type="button"
        :disabled="!canRequest || busy || locked || !valid || !approved"
        @click="recommend"
      >
        {{ busy ? copy.pending : assessment ? copy.assess : copy.request }}
      </button>
      <button v-if="busy" type="button" @click="invalidate">{{ copy.cancel }}</button>
      <button type="button" :disabled="!profile || locked" @click="manual">
        {{ copy.manual }}
      </button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div v-if="result" aria-live="polite">
      <p>{{ copy.advisory }}</p>
      <template v-if="isDataFigureAssessment(result)">
        <p>{{ copy.length }} · {{ (result.assessment.lengthAdequacy * 100).toFixed(2) }}</p>
        <p>{{ copy.content }} · {{ (result.assessment.contentReadiness * 100).toFixed(2) }}</p>
      </template>
      <p v-if="!result.candidates.length">{{ copy.empty }}</p>
      <ul v-else>
        <li v-for="candidate in result.candidates" :key="candidate.templateId">
          <button
            type="button"
            :disabled="!canRequest || locked"
            @click="choose(candidate.templateId)"
          >
            {{ copy.choose }} {{ candidate.templateId }} · {{ formatScore(candidate.suitability) }}
          </button>
        </li>
      </ul>
      <p v-if="selected" role="status">{{ copy.selected }} {{ selected }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DataFigureRoutingInput } from '@/backend/_jev/figureRouting';
import {
  isDataFigureRecommendations,
  isDataFigureAssessment,
  type DataFigureAssessment,
  type DataFigureRecommendations,
  type FigureTemplate,
} from '@/lib/figure/dataFigureTemplates';
import type { CsvProfile } from '@/src/services/browserFigures';
import { MemberApiError } from '@/src/services/memberApiClient';

const props = defineProps<{
  profile: CsvProfile | null;
  canRequest: boolean;
  locked?: boolean;
  assessment?: boolean;
  // Changes to member identity/consent invalidate even a request that never settles after abort.
  contextKey: string;
  request: (input: DataFigureRoutingInput, signal: AbortSignal) => Promise<unknown>;
}>();
const emit = defineEmits<{
  select: [template: FigureTemplate];
  invalidate: [];
  manual: [];
  assessed: [selection: { template: FigureTemplate; input: DataFigureRoutingInput }];
}>();
const { locale } = useI18n();
const copy = computed(() =>
  locale.value.startsWith('zh')
    ? {
        title: 'Jev 图型建议 · 需确认摘要',
        boundary:
          '仅把下方确认的字段摘要和目标发至官方 TypeSafe；不上传 CSV、原始列名或逐行值。不扣学分，不自动生成。',
        access:
          '需要登录、有学分余额且已同意 Jev 数据处理；服务端路由开关也须启用。可继续手动选图。',
        limit: '最多发送 32 个字段；当前数据请先使用手动图型选择，不会静默截断上传。',
        metadata: '审阅字段摘要',
        privacy:
          '默认只用 col_N 别名。请勿在别名、单位和目标中填写患者信息；类型和含义需自行确认。',
        alias: '字段别名',
        type: '类型',
        unit: '单位',
        goal: '出图目标',
        egress: '实际将发送的内容',
        approve: '我同意将此处显示的摘要发送至 TypeSafe',
        request: '获取图型建议',
        assess: '评估摘要与图型',
        length: '摘要长度适切性',
        content: '摘要内容充分性',
        pending: '正在判断本次摘要…',
        cancel: '取消建议请求',
        manual: '手动选择图型',
        advisory:
          '仅展示建议值 >80 的图型。这不是临床准确率或经校准的正确率，仍须人工确认数据映射与统计选项。',
        empty: '没有图型的建议值超过 80。请检查摘要或手动选择，不会切换付费模型。',
        choose: '选择',
        selected: '已选择：',
        errors: {
          202: '该摘要仍在处理中，请稍后手动重试。',
          401: '登录已失效，请重新登录。',
          402: '需要正学分余额才能获取建议。',
          403: '请检查 Jev 知情同意与访问权限。',
          404: '图型建议尚未启用，可手动选图。',
          429: '已达到请求上限，请稍后重试。',
          503: '建议暂不可用，可手动选图；不会自动重试或改用其他模型。',
        } as Record<number, string>,
      }
    : {
        title: 'Jev template advice · metadata approval',
        boundary:
          'Only the approved metadata and goal below go to official TypeSafe. No CSV, original column names or row values. No credit charge or automatic generation.',
        access:
          'Sign in with positive credits and accepted Jev consent. The server routing flag must also be enabled. Manual selection remains available.',
        limit:
          'At most 32 fields may be sent. Use manual selection for this dataset; nothing is silently truncated or uploaded.',
        metadata: 'Review metadata',
        privacy:
          'Defaults use col_N aliases only. Do not enter patient information in aliases, units or the goal; confirm types and meanings yourself.',
        alias: 'Field alias',
        type: 'Type',
        unit: 'Unit',
        goal: 'Figure goal',
        egress: 'Exactly what will be sent',
        approve: 'I approve sending exactly this metadata to TypeSafe',
        request: 'Get template suggestions',
        assess: 'Assess metadata and chart types',
        length: 'Length adequacy',
        content: 'Content readiness',
        pending: 'Assessing this metadata…',
        cancel: 'Cancel suggestions',
        manual: 'Choose a template manually',
        advisory:
          'Only suitability suggestions >80 are shown. These are not clinical accuracy or calibrated correctness. Confirm mappings and statistical options yourself.',
        empty:
          'No template exceeded 80. Revise the metadata or choose manually; no paid model fallback will run.',
        choose: 'Choose',
        selected: 'Selected:',
        errors: {
          202: 'This metadata is still being processed. Retry manually later.',
          401: 'Your session expired. Sign in again.',
          402: 'Positive credits are required for suggestions.',
          403: 'Check Jev consent and access permissions.',
          404: 'Template advice is not enabled. Choose manually.',
          429: 'Request limit reached. Retry later.',
          503: 'Advice is unavailable. Choose manually; no automatic retry or model fallback.',
        } as Record<number, string>,
      }
);
const fieldTypes = ['categorical', 'continuous', 'binary', 'date', 'count', 'proportion'] as const;
type Field = DataFigureRoutingInput['fields'][number] & { unit: string };
const fields = ref<Field[]>([]),
  goal = ref(''),
  approved = ref(false),
  busy = ref(false),
  error = ref('');
const result = ref<DataFigureRecommendations | DataFigureAssessment | null>(null),
  selected = ref<FigureTemplate | null>(null);
let epoch = 0,
  controller: AbortController | null = null;
const tooMany = computed(() => (props.profile?.columns.length ?? 0) > 32);
const input = computed<DataFigureRoutingInput>(() => ({
  fields: fields.value.map((field) => ({
    alias: field.alias.trim(),
    type: field.type,
    ...(field.unit.trim() ? { unit: field.unit.trim() } : {}),
  })),
  goal: goal.value.trim(),
}));
const valid = computed(
  () =>
    !!props.profile &&
    !tooMany.value &&
    input.value.fields.length > 0 &&
    input.value.goal.length > 0 &&
    input.value.goal.length <= 1000 &&
    input.value.fields.every(
      (field) =>
        field.alias.length > 0 && field.alias.length <= 120 && (field.unit?.length ?? 0) <= 48
    ) &&
    new Set(input.value.fields.map((field) => field.alias)).size === input.value.fields.length
);
function invalidate() {
  ++epoch;
  controller?.abort();
  controller = null;
  approved.value = false;
  busy.value = false;
  result.value = null;
  selected.value = null;
  error.value = '';
  emit('invalidate');
}
watch(
  () => props.profile,
  (profile) => {
    invalidate();
    fields.value =
      !profile || tooMany.value
        ? []
        : profile.columns.map((column) => ({
            alias: column.id,
            type: column.kind === 'numeric' ? 'continuous' : 'categorical',
            unit: '',
          }));
    goal.value = '';
  },
  { immediate: true }
);
watch([input, () => props.contextKey, () => props.assessment], invalidate, {
  deep: true,
  flush: 'sync',
});
watch(
  () => props.canRequest,
  (allowed) => {
    if (!allowed) invalidate();
  },
  { flush: 'sync' }
);
async function recommend() {
  if (!props.canRequest || props.locked || !approved.value || !valid.value || busy.value) return;
  const snapshot = JSON.parse(JSON.stringify(input.value)) as DataFigureRoutingInput;
  const run = ++epoch;
  const active = new AbortController();
  controller = active;
  busy.value = true;
  error.value = '';
  result.value = null;
  selected.value = null;
  emit('invalidate');
  try {
    const response = await props.request(snapshot, active.signal);
    if (run !== epoch || !props.canRequest) return;
    if (
      !(props.assessment ? isDataFigureAssessment(response) : isDataFigureRecommendations(response))
    )
      throw new MemberApiError('invalid_jev_figure_response', 503);
    result.value = response;
  } catch (e) {
    if (run === epoch)
      error.value =
        copy.value.errors[e instanceof MemberApiError ? e.status : 503] || copy.value.errors[503];
  } finally {
    if (run === epoch) {
      busy.value = false;
      controller = null;
    }
  }
}
function choose(template: FigureTemplate) {
  if (
    !props.canRequest ||
    props.locked ||
    !result.value?.candidates.some((candidate) => candidate.templateId === template)
  )
    return;
  selected.value = template;
  emit('select', template);
  if (props.assessment && isDataFigureAssessment(result.value))
    emit('assessed', { template, input: JSON.parse(JSON.stringify(input.value)) });
}
function manual() {
  invalidate();
  emit('manual');
}
function formatScore(value: number) {
  const score = value * 100;
  return score.toFixed(2) === '80.00' ? '>80' : score.toFixed(2);
}
onBeforeUnmount(invalidate);
</script>

<style scoped>
.data-routing {
  padding: 1rem;
  border: 1px solid var(--color-border, #475569);
  border-radius: 0.5rem;
  margin: 1rem 0;
}
h3 {
  font-size: 1rem;
  margin: 0 0 0.75rem;
}
p,
label,
summary {
  font-size: 0.875rem;
  line-height: 1.6;
}
fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}
input,
textarea,
select,
button {
  font: inherit;
  color: inherit;
  background: var(--color-bg-input, #0f172a);
  border: 1px solid var(--color-border, #475569);
  border-radius: 0.25rem;
  padding: 0.5rem;
  min-width: 0;
  max-width: 100%;
}
textarea {
  resize: vertical;
}
.metadata-field {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}
.approval {
  flex-direction: row;
  align-items: flex-start;
  margin-top: 0.75rem;
}
.approval input {
  margin-top: 0.375rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.75rem;
}
ul {
  padding-left: 1rem;
}
li {
  margin-bottom: 0.5rem;
}
button:not(:disabled) {
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
}
:focus-visible {
  outline: 2px solid var(--color-accent, #2dd4bf);
  outline-offset: 2px;
}
@media (max-width: 480px) {
  .metadata-field {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
