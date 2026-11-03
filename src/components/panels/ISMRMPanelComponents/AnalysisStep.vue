<template>
  <div class="space-y-4 max-h-[80vh] overflow-y-auto">
    <h2 class="text-xl font-bold">{{ t('analysis_ui.complete') }} · ISMRM 2027</h2>
    <p class="text-sm text-text-secondary">{{ t('ismrm2027.selection_help') }}</p>
    <p v-if="jevClassificationOnly" class="text-sm text-text-secondary">
      {{ t('membership.jev_optional_notes') }}
    </p>
    <div>
      <label for="impact-input" class="font-semibold block">{{
        t('analysis.impact_statement')
      }}</label>
      <textarea
        id="impact-input"
        v-model="localImpact"
        class="w-full p-3 border border-base-300 rounded-lg bg-base-100"
        aria-describedby="impact-word-count"
      />
      <p
        id="impact-word-count"
        :class="impactWordCount > 40 ? 'text-red-500' : 'text-text-secondary'"
      >
        {{ t('analysis.word_count', { count: impactWordCount, max: 40 }) }}
      </p>
    </div>
    <div>
      <label for="synopsis-input" class="font-semibold block">{{ t('analysis.synopsis') }}</label>
      <textarea
        id="synopsis-input"
        v-model="localSynopsis"
        class="w-full p-3 border border-base-300 rounded-lg bg-base-100"
        aria-describedby="synopsis-word-count"
      />
      <p
        id="synopsis-word-count"
        :class="synopsisWordCount > 100 ? 'text-red-500' : 'text-text-secondary'"
      >
        {{ t('analysis.word_count', { count: synopsisWordCount, max: 100 }) }}
      </p>
      <p class="text-sm text-text-secondary">{{ t('ismrm2027.synopsis_help') }}</p>
    </div>

    <p v-if="result.categories?.length" class="text-sm text-text-secondary">
      {{ t('ismrm2027.candidates') }}: {{ result.categories.map((c) => c.name).join('; ') }}
    </p>
    <div v-for="role in roles" :key="role.id">
      <label :for="role.id" class="font-semibold block mb-2">{{ t(role.label) }}</label>
      <select
        :id="role.id"
        :value="role.id === 'ismrm-primary' ? primary : secondary"
        @change="setCategory(role.id, $event)"
        class="w-full p-3 rounded-lg border border-base-300 bg-base-100"
      >
        <option value="">{{ t('ismrm2027.choose_category') }}</option>
        <option v-for="entry in ISMRM_SUBCATEGORIES" :key="entry.code" :value="entry.name">
          {{ entry.code }} · {{ entry.name }}
        </option>
      </select>
    </div>

    <div>
      <h3 class="font-semibold">{{ t('analysis.keywords') }} · {{ selectedKeys.length }}/5</h3>
      <p class="text-sm text-text-secondary">{{ t('ismrm2027.keyword_help') }}</p>
      <div class="flex flex-wrap gap-2 my-2">
        <button
          v-for="key in selectedKeys"
          :key="key"
          :data-test="'selected-ismrm-keyword-' + key"
          type="button"
          @click="removeKeyword(key)"
          :aria-label="t('ismrm2027.remove_keyword', { keyword: key })"
          class="px-3 py-2 rounded-full border border-brand-primary bg-brand-primary/20"
        >
          {{ key }} ×
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="key in suggestedKeys.filter((k) => !selectedKeys.includes(k))"
          :key="key"
          type="button"
          @click="addKeyword(key)"
          :disabled="selectedKeys.length >= 5"
          class="px-3 py-2 rounded-full border border-base-300 disabled:opacity-50"
        >
          {{ key }} +
        </button>
      </div>
      <label for="ismrm-general-keyword" class="block mt-2">{{
        t('ismrm2027.general_keyword')
      }}</label>
      <select
        id="ismrm-general-keyword"
        :value="''"
        @change="selectKeyword"
        :disabled="selectedKeys.length >= 5"
        class="w-full p-3 rounded-lg border border-base-300 bg-base-100"
      >
        <option value="">{{ t('ismrm2027.choose_keyword') }}</option>
        <option
          v-for="key in ISMRM_GENERAL_KEYWORDS.filter((k) => !selectedKeys.includes(k))"
          :key="key"
          :value="key"
        >
          {{ key }}
        </option>
      </select>
      <label for="ismrm-custom-keyword" class="block mt-2">{{
        t('ismrm2027.custom_keyword')
      }}</label>
      <div class="flex gap-2">
        <input
          id="ismrm-custom-keyword"
          v-model="customKeyword"
          maxlength="120"
          class="flex-1 min-w-0 p-3 border border-base-300 bg-base-100 rounded-lg"
          @keydown.enter.prevent="addCustomKeyword"
        />
        <button
          type="button"
          data-test="add-ismrm-keyword"
          @click="addCustomKeyword"
          :disabled="selectedKeys.length >= 5 || !customKeyword.trim()"
          class="p-3 border border-base-300 rounded-lg disabled:opacity-50"
        >
          {{ t('ismrm2027.add_keyword') }}
        </button>
      </div>
    </div>
    <p v-if="!canConfirm" class="text-sm text-text-secondary" role="status">
      {{ t('ismrm2027.confirm_help') }}
    </p>
    <button
      data-test="confirm-ismrm-analysis"
      @click="handleConfirm"
      :disabled="!canConfirm"
      class="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {{ t('analysis.confirm_selections') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AnalysisResult, Category } from '@/types';
import { ISMRM_SUBCATEGORIES, ISMRM_GENERAL_KEYWORDS } from '@/lib/llm/prompts/ismrmData';

const { t } = useI18n();
const props = defineProps<{
  result: AnalysisResult;
  impact: string;
  synopsis: string;
  jevClassificationOnly?: boolean;
}>();
const emit = defineEmits<{
  confirm: [cats: Category[], keys: string[], impact: string, synopsis: string];
}>();

const candidates = [...(Array.isArray(props.result.categories) ? props.result.categories : [])]
  .filter((c) => ISMRM_SUBCATEGORIES.some((entry) => entry.name === c.name))
  .sort((a, b) => b.probability - a.probability);
const primary = ref(candidates.find((c) => c.type === 'main')?.name ?? candidates[0]?.name ?? '');
const secondary = ref(
  candidates.find((c) => c.type === 'secondary' && c.name !== primary.value)?.name ??
    candidates.find((c) => c.name !== primary.value)?.name ??
    ''
);
const roles = [
  { id: 'ismrm-primary', label: 'ismrm2027.primary' },
  { id: 'ismrm-secondary', label: 'ismrm2027.secondary' },
];
const suggestedKeys = [
  ...new Set(
    (props.result.keywords ?? [])
      .filter((k) => typeof k === 'string' && k.trim())
      .map((k) => k.trim())
  ),
];
// Do not silently truncate model recommendations; excess chips remain removable.
const selectedKeys = ref([...suggestedKeys]);
const customKeyword = ref('');
const localImpact = ref(props.impact);
const localSynopsis = ref(props.synopsis);
const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const impactWordCount = computed(() => wordCount(localImpact.value));
const synopsisWordCount = computed(() => wordCount(localSynopsis.value));
const canConfirm = computed(
  () =>
    primary.value &&
    secondary.value &&
    primary.value !== secondary.value &&
    ISMRM_SUBCATEGORIES.some((c) => c.name === primary.value) &&
    ISMRM_SUBCATEGORIES.some((c) => c.name === secondary.value) &&
    selectedKeys.value.length >= 1 &&
    selectedKeys.value.length <= 5 &&
    impactWordCount.value <= 40 &&
    synopsisWordCount.value <= 100 &&
    (props.jevClassificationOnly || (localImpact.value.trim() && localSynopsis.value.trim()))
);
function setCategory(id: string, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (id === 'ismrm-primary') primary.value = value;
  else secondary.value = value;
}
function addKeyword(key: string) {
  const trimmed = key.trim();
  if (trimmed && selectedKeys.value.length < 5 && !selectedKeys.value.includes(trimmed))
    selectedKeys.value.push(trimmed);
}
function removeKeyword(key: string) {
  selectedKeys.value = selectedKeys.value.filter((k) => k !== key);
}
function selectKeyword(event: Event) {
  const select = event.target as HTMLSelectElement;
  addKeyword(select.value);
  select.value = '';
}
function addCustomKeyword() {
  addKeyword(customKeyword.value);
  customKeyword.value = '';
}
function handleConfirm() {
  if (!canConfirm.value) return;
  const category = (name: string, type: Category['type']): Category => ({
    name,
    type,
    probability: candidates.find((c) => c.name === name)?.probability ?? 1,
  });
  emit(
    'confirm',
    [category(primary.value, 'main'), category(secondary.value, 'secondary')],
    [...selectedKeys.value],
    localImpact.value,
    localSynopsis.value
  );
}
</script>
