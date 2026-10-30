<template>
  <section class="figure-workspace" aria-label="Data figures">
    <header class="figure-heading">
      <div>
        <p class="eyebrow">LOCAL DATA · TRUSTED TEMPLATES</p>
        <h2>{{ copy.title }}</h2>
      </div>
      <span class="validation-badge">{{ copy.validation }}</span>
    </header>
    <p class="notice">{{ copy.boundary }}</p>
    <p v-if="!canRender" class="notice" role="status">{{ copy.access }}</p>
    <div class="figure-grid">
      <div class="figure-controls">
        <fieldset :disabled="busy || !canRender">
          <legend>01 · {{ copy.data }}</legend>
          <label class="file-label"
            >{{ copy.file }}<input type="file" accept=".csv,text/csv" @change="loadFile"
          /></label>
          <label
            >{{ copy.csv
            }}<textarea
              v-model="csvText"
              rows="5"
              maxlength="10485760"
              spellcheck="false"
              :placeholder="copy.csvHint"
              @input="resetDataset"
            />
          </label>
          <div class="actions">
            <button type="button" class="secondary" @click="loadExample">{{ copy.example }}</button
            ><button type="button" :disabled="!csvText" @click="inspect">{{ copy.inspect }}</button>
          </div>
          <p v-if="profile" class="profile">
            {{ copy.profile(profile.row_count, profile.columns.length) }}
          </p>
          <ul v-if="profile" class="schema">
            <li v-for="column in profile.columns" :key="column.id">
              <code>{{ column.id }}</code> {{ column.name }}
              <span>{{ column.kind }} · {{ column.missing_count }} {{ copy.missing }}</span>
            </li>
          </ul>
        </fieldset>
        <fieldset :disabled="busy || !profile || !canRender">
          <legend>02 · {{ copy.plan }}</legend>
          <label
            >{{ copy.template
            }}<select v-model="template">
              <option v-for="(_, id) in FIGURE_TEMPLATES" :key="id" :value="id">{{ id }}</option>
            </select></label
          >
          <label
            >{{ copy.style
            }}<select v-model="style">
              <option v-for="(_, id) in FIGURE_STYLES" :key="id" :value="id">
                {{ id === 'standard' ? 'Standard' : `${id.toUpperCase()} · inspired` }}
              </option>
            </select></label
          >
          <div class="mapping-grid">
            <label v-for="role in roles.required" :key="role"
              >{{ role
              }}<select v-model="mapping[role]">
                <option value="">{{ copy.choose }}</option>
                <option v-for="column in profile?.columns" :key="column.id" :value="column.id">
                  {{ column.name }} · {{ column.id }}
                </option>
              </select></label
            >
            <label v-for="role in roles.optional" :key="role"
              >{{ role }} · {{ copy.optional
              }}<select v-model="mapping[role]">
                <option value="">{{ copy.none }}</option>
                <option v-for="column in profile?.columns" :key="column.id" :value="column.id">
                  {{ column.name }} · {{ column.id }}
                </option>
              </select></label
            >
            <label v-for="role in roles.units" :key="`unit-${role}`"
              >{{ copy.unit }} · {{ role
              }}<input v-model="units[role]" maxlength="48" :placeholder="copy.unitHint"
            /></label>
          </div>
          <label v-if="roles.options"
            >{{ copy.options
            }}<textarea
              v-model="optionsText"
              rows="4"
              maxlength="65536"
              spellcheck="false"
              :placeholder="roles.options"
            />
          </label>
          <details>
            <summary>{{ copy.advanced }}</summary>
            <label
              >{{ copy.frozen
              }}<textarea
                v-model="importedPlan"
                rows="8"
                maxlength="65536"
                spellcheck="false"
                :placeholder="copy.frozenHint"
              />
            </label>
            <p>{{ copy.advancedHint }}</p>
          </details>
          <details v-if="plan">
            <summary>{{ copy.showPlan }}</summary>
            <pre>{{ JSON.stringify(plan, null, 2) }}</pre>
          </details>
          <p v-if="profile && !plan" class="fine-print">{{ copy.invalidPlan }}</p>
          <label class="confirmation"
            ><input v-model="confirmed" type="checkbox" :disabled="!plan" />{{
              copy.confirm
            }}</label
          >
          <button type="button" :disabled="!confirmed || !plan" @click="renderPreview">
            {{ copy.render }}
          </button>
        </fieldset>
        <button v-if="busy" type="button" class="secondary" @click="cancel">
          {{ copy.cancel }}
        </button>
      </div>
      <div class="figure-output" :aria-busy="busy">
        <div class="output-header">
          <h3>{{ copy.preview }}</h3>
          <span>PNG · 600 DPI</span>
        </div>
        <p v-if="busy" role="status" class="runtime-status">{{ copy.progress(stage) }}</p>
        <p v-if="error" role="alert" class="error">{{ copy.error }} {{ error }}</p>
        <figure v-if="preview">
          <img :src="`data:image/png;base64,${preview.preview}`" :alt="copy.previewAlt" />
          <figcaption>
            {{ preview.manifest.width_px }} × {{ preview.manifest.height_px }} ·
            {{ Math.round(preview.manifest.dpi) }} DPI · {{ preview.manifest.style_version }}
          </figcaption>
        </figure>
        <div v-else-if="!busy" class="empty-preview">
          <span aria-hidden="true">▥</span>
          <p>{{ copy.empty }}</p>
        </div>
        <p class="fine-print">{{ copy.watermark }}</p>
        <button type="button" class="secondary" disabled :title="copy.authorization">
          {{ copy.download }}
        </button>
        <p class="fine-print">{{ copy.authorization }}</p>
        <details v-if="preview">
          <summary>{{ copy.provenance }}</summary>
          <pre>{{ JSON.stringify(preview.manifest, null, 2) }}</pre>
        </details>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  BrowserFigureSession,
  createFigureSpec,
  FIGURE_STYLES,
  FIGURE_TEMPLATES,
  type BrowserFigurePreview,
  type CsvProfile,
  type FigureStyle,
  type FigureTemplate,
} from '@/src/services/browserFigures';

const props = defineProps<{ canRender: boolean }>();
const { locale } = useI18n();
const zh = computed(() => locale.value.startsWith('zh'));
const copy = computed(() =>
  zh.value
    ? {
        title: '数据统计图',
        validation: '本地接入验证 · 尚未上线',
        boundary:
          '数据仅在此浏览器的独立 Worker 中读取和绘图。本切片不调用 AI、不扣学分；正式会员生成/结算尚未接通，不代表已完成付费生成。',
        access: '请先登录有学分余额的会员账户。',
        data: '本地数据',
        file: 'CSV 文件 · UTF-8 · 最多 10 MiB',
        csv: 'CSV 内容',
        csvHint: '粘贴逗号分隔的 UTF-8 数据，首行为列名',
        example: '加载合成案例',
        inspect: '检查本地 CSV',
        profile: (rows: number, cols: number) => `${rows} 行 · ${cols} 列`,
        missing: '缺失',
        plan: '确认绘图方案',
        template: '图型',
        style: '期刊 inspired 风格',
        choose: '选择字段',
        optional: '可选',
        none: '不使用',
        unit: '单位',
        unitHint: '明确填写，如 mm、ratio 或 count',
        options: '显式统计选项（JSON）',
        advanced: '导入冻结 FigureSpec / 多面板方案',
        frozen: '完整 FigureSpec JSON',
        frozenHint: '留空时使用上述映射；填写时替代映射方案，数据哈希须匹配',
        advancedHint:
          '仅接受现有模板的严格 JSON，不执行 Python、URL 或脚本。缺失值、区间、分母及雷达轴必须明确，不能由模型捏造。',
        showPlan: '查看冻结方案',
        confirm: '我确认字段、单位与冻结方案',
        render: '渲染本地验证预览',
        cancel: '取消并释放运行时',
        preview: '预览',
        previewAlt: '数据统计图预览',
        progress: (s: string) =>
          ({
            'loading-runtime': '正在加载同站 Python 运行时…',
            'loading-matplotlib': '正在加载绘图依赖…',
            rendering: '正在本地校验和绘图…',
            inspecting: '正在检查本地数据…',
          })[s] || '正在准备本地运行时…',
        error: '未完成：',
        empty: '选择本地数据并确认方案后预览',
        watermark: '预览含 sci-necromancer 隐密标记。客户端水印可被绕过，不是防复制或真实性证明。',
        download: '下载原图 · 会员授权后免费',
        authorization:
          '会员版本结算与免费授权尚未接通，因此此处不提供无水印 PNG / PDF / SVG / 复现包，也不额外扣下载学分。',
        provenance: '实际运行时与产物记录',
        invalidPlan: '请检查 JSON、字段映射和单位；不得覆盖数据哈希或注入脚本。',
        unsupported: '当前字体不支持部分标签，请使用受支持的拉丁字符；不会静默生成缺字图。',
      }
    : {
        title: 'Data figures',
        validation: 'Local integration · not released',
        boundary:
          'Data stays in this browser Worker. This slice makes no AI calls and charges no credits; member generation and settlement are not connected yet.',
        access: 'Sign in with a positive credit balance to use this workspace.',
        data: 'Local data',
        file: 'CSV file · UTF-8 · max 10 MiB',
        csv: 'CSV content',
        csvHint: 'Paste comma-separated UTF-8 data with a header row',
        example: 'Load synthetic example',
        inspect: 'Inspect local CSV',
        profile: (rows: number, cols: number) => `${rows} rows · ${cols} columns`,
        missing: 'missing',
        plan: 'Confirm figure plan',
        template: 'Chart type',
        style: 'Journal-inspired style',
        choose: 'Select a field',
        optional: 'optional',
        none: 'None',
        unit: 'Unit',
        unitHint: 'Explicit unit, e.g. mm, ratio or count',
        options: 'Explicit statistical options (JSON)',
        advanced: 'Import frozen FigureSpec / multipanel plan',
        frozen: 'Complete FigureSpec JSON',
        frozenHint:
          'Leave empty to use the mappings above; imported plans must match the dataset hash',
        advancedHint:
          'Strict JSON for existing templates only. No Python, URLs or scripts. Intervals, denominators and radar axes must be explicit, never invented.',
        showPlan: 'View frozen plan',
        confirm: 'I confirm the fields, units and frozen plan',
        render: 'Render local validation preview',
        cancel: 'Cancel and release runtime',
        preview: 'Preview',
        previewAlt: 'Data figure preview',
        progress: (s: string) =>
          ({
            'loading-runtime': 'Loading same-origin Python runtime…',
            'loading-matplotlib': 'Loading plotting dependencies…',
            rendering: 'Validating and rendering locally…',
            inspecting: 'Inspecting local data…',
          })[s] || 'Preparing local runtime…',
        error: 'Not completed:',
        empty: 'Choose local data and confirm a plan to preview',
        watermark:
          'Preview contains a hidden sci-necromancer marker. Client-side watermarks are bypassable, not copy protection or proof of authenticity.',
        download: 'Download original · free with authorization',
        authorization:
          'Member version settlement and free export authorization are not connected. Original PNG / PDF / SVG / reproduction bundles are not exposed here. Downloads will not add a credit charge.',
        provenance: 'Actual runtime and artifact record',
        invalidPlan:
          'Check JSON, field mappings and units; do not override the dataset hash or inject scripts.',
        unsupported:
          'The current font does not support some labels. Use supported Latin characters; missing glyphs are not silently rendered.',
      }
);
const session = new BrowserFigureSession();
const csvText = ref('');
let payload: Uint8Array | null = null;
let operation = 0;
const profile = ref<CsvProfile | null>(null),
  preview = ref<BrowserFigurePreview | null>(null);
const template = ref<FigureTemplate>('grouped-bar'),
  style = ref<FigureStyle>('nature');
const mapping = ref<Record<string, string>>({}),
  units = ref<Record<string, string>>({});
const optionsText = ref(''),
  importedPlan = ref(''),
  confirmed = ref(false),
  busy = ref(false),
  stage = ref(''),
  error = ref('');
const roleCatalog: Record<
  FigureTemplate,
  { required: string[]; optional: string[]; units: string[]; options?: string }
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
const roles = computed(() => roleCatalog[template.value]);
const plan = computed(() => {
  if (!profile.value) return null;
  try {
    if (importedPlan.value.trim()) {
      if (importedPlan.value.length > 64 * 1024) return null;
      const imported = JSON.parse(importedPlan.value);
      if (
        !imported ||
        Array.isArray(imported) ||
        typeof imported !== 'object' ||
        imported.dataset_sha256 !== profile.value.dataset_sha256
      )
        return null;
      return imported as Record<string, unknown>;
    }
    if (
      roles.value.required.some((role) => !mapping.value[role]) ||
      roles.value.units.some((role) => !units.value[role]?.trim())
    )
      return null;
    if (optionsText.value.length > 64 * 1024) return null;
    const extra = optionsText.value.trim() ? JSON.parse(optionsText.value) : {};
    if (
      !extra ||
      Array.isArray(extra) ||
      typeof extra !== 'object' ||
      Object.keys(extra).some(
        (k) =>
          !['interval', 'ranking', 'composition', 'volcano', 'radar', 'distribution'].includes(k)
      )
    )
      return null;
    const selectedMapping = Object.fromEntries(
      [...roles.value.required, ...roles.value.optional]
        .filter((role) => mapping.value[role])
        .map((role) => [role, mapping.value[role]])
    );
    const selectedUnits = Object.fromEntries(
      roles.value.units.map((role) => [role, units.value[role].trim()])
    );
    const base = createFigureSpec(
      profile.value.dataset_sha256,
      template.value,
      selectedMapping,
      selectedUnits,
      style.value
    );
    if (template.value === 'distribution' && extra.distribution)
      base.template_version = 'distribution-histogram-v1';
    return { ...base, ...extra };
  } catch {
    return null;
  }
});
watch(
  [template, style, mapping, units, optionsText, importedPlan],
  () => {
    confirmed.value = false;
    preview.value = null;
  },
  { deep: true, flush: 'sync' }
);
watch(template, () => {
  mapping.value = {};
  units.value = {};
  optionsText.value = '';
});
watch(
  () => props.canRender,
  (allowed) => {
    if (!allowed) {
      cancel();
      resetDataset();
      csvText.value = '';
    }
  }
);
function resetDataset() {
  profile.value = null;
  payload = null;
  preview.value = null;
  confirmed.value = false;
  error.value = '';
  mapping.value = {};
  units.value = {};
  optionsText.value = '';
  importedPlan.value = '';
}
function loadExample() {
  resetDataset();
  csvText.value = 'Category,Value\nTreatment,12\nControl,9\n';
}
async function loadFile(event: Event) {
  if (!props.canRender || busy.value) return;
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  resetDataset();
  const run = ++operation;
  busy.value = true;
  stage.value = 'inspecting';
  try {
    if (!/\.csv$/i.test(file.name) || file.size > 10 * 1024 * 1024)
      throw new Error('invalid_csv_size');
    const bytes = await file.arrayBuffer();
    if (run === operation && props.canRender) {
      csvText.value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    }
  } catch {
    if (run === operation) {
      csvText.value = '';
      error.value = 'invalid_csv_file';
    }
  } finally {
    if (run === operation) busy.value = false;
    input.value = '';
  }
}
async function inspect() {
  if (!props.canRender || busy.value) return;
  resetDataset();
  const run = ++operation;
  busy.value = true;
  stage.value = 'loading-runtime';
  try {
    const bytes = new TextEncoder().encode(csvText.value);
    const result = await session.inspect(bytes);
    if (run !== operation) return;
    profile.value = result;
    payload = bytes;
    mapping.value = {};
    units.value = {};
  } catch (e) {
    if (run === operation) error.value = e instanceof Error ? e.message : 'figure_runtime_failed';
  } finally {
    if (run === operation) busy.value = false;
  }
}
async function renderPreview() {
  if (!props.canRender || busy.value || !confirmed.value || !plan.value || !payload) return;
  const frozen = JSON.parse(JSON.stringify(plan.value));
  const run = ++operation;
  busy.value = true;
  error.value = '';
  preview.value = null;
  stage.value = 'rendering';
  try {
    const result = await session.render(payload, frozen, (s) => {
      if (run === operation) stage.value = s;
    });
    if (run === operation) preview.value = result;
  } catch (e) {
    if (run === operation) {
      const code = e instanceof Error ? e.message : 'figure_runtime_failed';
      error.value = code.includes('glyph') ? copy.value.unsupported : code;
    }
  } finally {
    if (run === operation) busy.value = false;
  }
}
function cancel() {
  ++operation;
  session.dispose();
  busy.value = false;
  stage.value = '';
  confirmed.value = false;
}
onBeforeUnmount(() => {
  cancel();
  payload = null;
  csvText.value = '';
  profile.value = null;
  preview.value = null;
});
</script>

<style scoped>
.figure-workspace {
  color: var(--color-text-primary, #e2e8f0);
}
.figure-heading,
.output-header,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
h2 {
  font-size: 1.4rem;
  font-weight: 650;
}
h3 {
  font-weight: 600;
}
.eyebrow {
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: #5eead4;
  margin-bottom: 0.3rem;
}
.validation-badge {
  font-size: 0.75rem;
  border: 1px solid #3b5b66;
  border-radius: 20px;
  padding: 0.3rem 0.75rem;
  color: #a8c7ce;
}
.notice,
.fine-print {
  color: #94a3b8;
  font-size: 0.8rem;
  line-height: 1.65;
  margin: 0.8rem 0;
}
.notice {
  border-left: 2px solid #0d9488;
  padding-left: 0.8rem;
}
.figure-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 1.5rem;
  margin-top: 1.4rem;
}
.figure-controls {
  min-width: 0;
}
fieldset,
.figure-output {
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 1.2rem;
  background: #0f172a66;
  margin-bottom: 1rem;
  min-width: 0;
}
legend {
  padding: 0 0.4rem;
  color: #b8d0d6;
  font-size: 0.85rem;
  font-weight: 600;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0.7rem 0;
  font-size: 0.8rem;
  color: #cbd5e1;
}
input:not([type='checkbox']),
select,
textarea {
  width: 100%;
  box-sizing: border-box;
  background: #0b1424;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e2e8f0;
  padding: 0.65rem;
  font: inherit;
}
textarea {
  resize: vertical;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
}
select {
  color-scheme: dark;
}
.mapping-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 0.8rem;
}
.confirmation {
  flex-direction: row;
  align-items: start;
  gap: 0.5rem;
}
.confirmation input {
  margin-top: 0.2rem;
}
button {
  padding: 0.65rem 0.9rem;
  border-radius: 8px;
  background: #0f766e;
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
}
button.secondary {
  background: #243245;
  color: #cedbe9;
}
button:disabled,
fieldset:disabled {
  opacity: 0.5;
}
button:disabled {
  cursor: not-allowed;
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
summary:focus-visible {
  outline: 2px solid #5eead4;
  outline-offset: 3px;
}
.schema {
  font-size: 0.7rem;
  max-height: 150px;
  overflow: auto;
}
.schema li {
  padding: 0.3rem 0;
  border-bottom: 1px solid #283747;
}
.schema span {
  float: right;
  color: #94a3b8;
}
.profile {
  color: #5eead4;
  font-size: 0.8rem;
  margin: 0.8rem 0;
}
.output-header {
  border-bottom: 1px solid #334155;
  padding-bottom: 0.8rem;
}
.output-header span {
  font-size: 0.7rem;
  color: #94a3b8;
}
.empty-preview {
  min-height: 300px;
  display: grid;
  align-content: center;
  justify-items: center;
  color: #64748b;
  font-size: 0.85rem;
  gap: 0.8rem;
}
.empty-preview span {
  font-size: 3rem;
  color: #47606f;
}
figure {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  margin: 1rem 0;
}
figure img {
  width: 100%;
  height: auto;
  display: block;
}
figcaption {
  background: #182333;
  color: #a8b8c9;
  font-size: 0.65rem;
  padding: 0.5rem;
}
details {
  margin: 0.8rem 0;
  color: #94a3b8;
  font-size: 0.75rem;
}
summary {
  cursor: pointer;
}
pre {
  overflow: auto;
  max-height: 280px;
  font-size: 0.65rem;
  padding: 0.7rem;
  background: #0b1424;
  border-radius: 6px;
  margin-top: 0.5rem;
}
.runtime-status {
  padding: 3rem 0;
  text-align: center;
  color: #5eead4;
}
.error {
  color: #fda4af;
  font-size: 0.8rem;
  overflow-wrap: anywhere;
  padding: 0.5rem 0;
}
@media (max-width: 900px) {
  .figure-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .figure-output {
    min-height: 350px;
  }
}
@media (max-width: 450px) {
  .mapping-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  fieldset,
  .figure-output {
    padding: 0.8rem;
  }
}
</style>
