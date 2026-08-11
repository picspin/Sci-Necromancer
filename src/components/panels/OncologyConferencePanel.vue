<template>
  <section class="space-y-6" :data-conference="conference">
    <header class="rounded-lg border border-base-300 bg-base-100 p-4">
      <h2 class="text-xl font-bold text-text-primary">
        {{ conference }} · {{ conferenceModule.name }}
      </h2>
      <p class="mt-1 text-sm text-text-secondary">
        {{
          conference === 'ASCO' ? t('oncology.asco_description') : t('oncology.esmo_description')
        }}
      </p>
      <p class="mt-2 text-xs text-text-secondary">
        {{ t('oncology.rule_version') }}: {{ profile.ruleVersion }}
      </p>
    </header>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div class="space-y-4 rounded-lg bg-base-100 p-4">
        <ModeSelector :mode="mode" @set-mode="setMode" />

        <div v-if="mode === 'standard'" class="space-y-3">
          <label
            class="block text-sm font-medium text-text-secondary"
            :for="`${conference}-file-upload`"
          >
            {{ t('forms.upload_file') }}
          </label>
          <input
            :id="`${conference}-file-upload`"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            class="block w-full text-sm text-text-secondary file:mr-4 file:rounded-md file:border-0 file:bg-brand-primary/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-primary hover:file:bg-brand-primary/30"
            :aria-label="t('ui.upload_file')"
            @change="handleFileChange"
          />
        </div>

        <label class="block text-sm font-medium text-text-secondary" :for="`${conference}-input`">
          {{ mode === 'standard' ? t('forms.paste_text') : t('oncology.creative_hint') }}
        </label>
        <textarea
          :id="`${conference}-input`"
          v-model="inputText"
          class="h-60 w-full rounded-md border border-base-300 bg-base-100 p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          :placeholder="
            mode === 'standard' ? t('forms.paste_text') : t('forms.creative_placeholder')
          "
          @input="handleTextChange"
        />

        <div v-if="mode === 'standard'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            :disabled="isLoading || !inputText.trim()"
            class="rounded-lg bg-base-300 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            @click="handleAnalyze"
          >
            {{ t('buttons.analyze_content') }}
          </button>
          <button
            type="button"
            :disabled="isLoading || !analysisConfirmed || Boolean(generatedAbstract)"
            class="rounded-lg bg-brand-primary px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            @click="handleGenerate"
          >
            {{ t('buttons.generate_abstract') }}
          </button>
        </div>
        <button
          v-else
          type="button"
          :disabled="isLoading || !inputText.trim() || Boolean(generatedAbstract)"
          class="w-full rounded-lg bg-brand-primary px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          @click="handleCreative"
        >
          {{ t('buttons.generate_creatively') }}
        </button>

        <div v-if="generatedAbstract" class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white"
            :disabled="isLoading"
            @click="openSaveModal"
          >
            {{ t('buttons.save_abstract') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white"
            :disabled="isLoading"
            @click="clearAll"
          >
            {{ t('buttons.clear_all') }}
          </button>
        </div>
        <button
          v-if="generatedAbstract"
          type="button"
          class="w-full rounded-lg bg-purple-700 px-4 py-2 font-semibold text-white"
          :disabled="isLoading || deepUpdateCompleted"
          @click="handleDeepUpdate"
        >
          {{ t('buttons.deep_update') }}
        </button>
      </div>

      <OutputDisplay
        :abstract="generatedAbstract"
        :categories="selectedCategories"
        :keywords="selectedKeywords"
        :is-loading="isLoading"
        :error="error"
        :loading-message="loadingMessage"
        :conference="conference"
        :source-text="inputText"
        :creative-mode="mode === 'creative'"
        :abstract-type="selectedAbstractType"
      />
    </div>

    <Modal
      v-if="isAnalysisModalOpen && classification"
      size="lg"
      :aria-label="t('oncology.analysis_complete')"
      @close="cancelAnalysis"
    >
      <aside class="space-y-3 text-sm" aria-live="polite">
        <h3 class="font-semibold text-text-primary">{{ t('oncology.analysis_complete') }}</h3>

        <label class="block text-xs font-medium text-text-secondary" :for="`${conference}-type`">
          {{ t('oncology.submission_type') }}
        </label>
        <select
          :id="`${conference}-type`"
          v-model="selectedAbstractType"
          class="w-full rounded-md border border-base-300 bg-base-100 p-2 text-text-primary"
        >
          <option v-for="type in conferenceModule.abstractTypes" :key="type" :value="type">
            {{ type }}
          </option>
        </select>

        <label
          class="block text-xs font-medium text-text-secondary"
          :for="`${conference}-category`"
        >
          {{ t('oncology.official_category') }}
        </label>
        <select
          :id="`${conference}-category`"
          :value="selectedCategories[0]?.name"
          class="w-full rounded-md border border-base-300 bg-base-100 p-2 text-text-primary"
          @change="selectCategory"
        >
          <option
            v-for="category in conferenceModule.getCategories()"
            :key="category.name"
            :value="category.name"
          >
            {{ category.name }}
          </option>
        </select>

        <p>
          <strong>{{ t('oncology.submission_type') }}:</strong>
          {{ classification.submissionType }}
        </p>
        <p>
          <strong>{{ t('oncology.category') }}:</strong> {{ selectedCategories[0]?.name }}
        </p>
        <p>
          <strong>{{ t('oncology.study_design') }}:</strong> {{ classification.studyDesign }}
        </p>
        <p>
          <strong>{{ t('oncology.confidence') }}:</strong>
          {{ Math.round((classification.confidence ?? 0) * 100) }}%
        </p>
        <p v-if="classification.presentationRecommendation">
          <strong>{{ t('oncology.presentation_recommendation') }}:</strong>
          {{ classification.presentationRecommendation }}
        </p>
        <p
          v-if="conference === 'ESMO' && classification.presentationRecommendation"
          class="text-xs text-amber-200"
        >
          {{ t('oncology.presentation_advisory') }}
        </p>
        <p class="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
          {{ t('oncology.author_review_required') }}
        </p>
        <button
          type="button"
          class="w-full rounded-lg bg-brand-primary px-4 py-3 font-bold text-white hover:bg-brand-secondary"
          @click="confirmAnalysis"
        >
          {{ t('oncology.confirm_continue') }}
        </button>
      </aside>
    </Modal>

    <Modal v-if="showSaveModal" @close="showSaveModal = false">
      <div class="space-y-4">
        <h2 class="text-xl font-bold text-text-primary">{{ t('oncology.save_title') }}</h2>
        <label
          class="block text-sm font-medium text-text-secondary"
          :for="`${conference}-save-title`"
        >
          {{ t('common.title') }}
        </label>
        <input
          :id="`${conference}-save-title`"
          ref="saveTitleInput"
          v-model="saveTitle"
          type="text"
          class="w-full rounded-md border border-base-300 bg-base-100 p-3 text-text-primary"
        />
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md border border-base-300 px-4 py-2"
            @click="showSaveModal = false"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-md bg-brand-primary px-4 py-2 text-white"
            :disabled="!saveTitle.trim() || isLoading"
            @click="handleSaveAbstract"
          >
            {{ currentAbstractId ? t('common.edit') : t('common.save') }}
          </button>
        </div>
      </div>
    </Modal>

    <WorkflowReentryDialog ref="workflowReentryDialog" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  AbstractData,
  AbstractType,
  Category,
  GenerationMode,
  OncologyClassification,
  SavedAbstract,
} from '@/types';
import * as llm from '@/lib/llm';
import { ASCOModule } from '@/lib/conference/modules/ASCOModule';
import { ESMOModule } from '@/lib/conference/modules/ESMOModule';
import {
  buildOncologyPrompt,
  classifyOncologyAbstract,
  getOncologyProfile,
  type OncologyConference,
} from '@/lib/conference/oncologyRules';
import { fileProcessingService } from '@/lib/file/FileProcessingService';
import { localizeError } from '@/lib/i18n/errorMessages';
import {
  getManagedAnalysisRetryNotice,
  prepareManagedTextReentry,
} from '@/lib/llm/managedTextWorkflow';
import { useAbstract } from '@/composables/useAbstract';
import { useSettings } from '@/composables/useSettings';
import Modal from '@/components/ui/Modal.vue';
import OutputDisplay from '@/components/OutputDisplay.vue';
import WorkflowReentryDialog from '@/components/membership/WorkflowReentryDialog.vue';
import ModeSelector from './ISMRMPanelComponents/ModeSelector.vue';

const props = defineProps<{ conference: OncologyConference }>();
const { t } = useI18n();
const { databaseService } = useSettings();
const { abstractToLoad, clearLoadedAbstract } = useAbstract();

const conferenceModule = computed(() =>
  props.conference === 'ASCO' ? new ASCOModule() : new ESMOModule()
);
const profile = computed(() => getOncologyProfile(props.conference));
const workflowContext = computed(() => `${props.conference}:${inputText.value}`);

const mode = ref<GenerationMode>('standard');
const inputText = ref('');
const selectedAbstractType = ref<AbstractType>(conferenceModule.value.abstractTypes[0]);
const classification = ref<OncologyClassification | null>(null);
const selectedCategories = ref<Category[]>([]);
const selectedKeywords = ref<string[]>([]);
const generatedAbstract = ref<AbstractData | null>(null);
const isLoading = ref(false);
const loadingMessage = ref(t('output.generating'));
const error = ref<string | null>(null);
const currentAbstractId = ref<string | null>(null);
const showSaveModal = ref(false);
const saveTitle = ref('');
const saveTitleInput = ref<HTMLInputElement | null>(null);
const workflowReentryDialog = ref<InstanceType<typeof WorkflowReentryDialog> | null>(null);
const generateAfterReanalysis = ref(false);
const deepUpdateCompleted = ref(false);
const isAnalysisModalOpen = ref(false);
const analysisConfirmed = ref(false);

const abstractTypeForSubmission = (submissionType: OncologyClassification['submissionType']) => {
  const map: Record<
    OncologyConference,
    Record<OncologyClassification['submissionType'], AbstractType>
  > = {
    ASCO: {
      regular: 'ASCO Regular Abstract',
      'lba-shell': 'ASCO Late-Breaking Shell',
      'lba-intent': 'ASCO Late-Breaking Shell',
      'lba-final': 'ASCO Late-Breaking Abstract',
      'trial-in-progress': 'ASCO Trials in Progress',
    },
    ESMO: {
      regular: 'ESMO Regular Abstract',
      'lba-shell': 'ESMO Late-Breaking Intent',
      'lba-intent': 'ESMO Late-Breaking Intent',
      'lba-final': 'ESMO Late-Breaking Abstract',
      'trial-in-progress': 'ESMO Trial in Progress',
    },
  };
  return map[props.conference][submissionType];
};

const resetGeneratedState = () => {
  classification.value = null;
  selectedCategories.value = [];
  selectedKeywords.value = [];
  generatedAbstract.value = null;
  deepUpdateCompleted.value = false;
  isAnalysisModalOpen.value = false;
  analysisConfirmed.value = false;
  selectedAbstractType.value = conferenceModule.value.abstractTypes[0];
};

const handleTextChange = () => {
  if (classification.value || generatedAbstract.value) resetGeneratedState();
};

const applyClassification = (text: string, modelKeywords: string[] = []) => {
  const inferred = classifyOncologyAbstract(props.conference, text);
  classification.value = inferred;
  selectedAbstractType.value = abstractTypeForSubmission(inferred.submissionType);
  selectedCategories.value = [
    { name: inferred.primaryCategory, type: 'main', probability: inferred.confidence ?? 0.5 },
  ];
  selectedKeywords.value = modelKeywords.length
    ? modelKeywords
    : conferenceModule.value.getKeywords().slice(0, 5);
  return inferred;
};

const attachCompliance = (result: AbstractData, inferred: OncologyClassification) => {
  result.oncology = inferred;
  result.categories = selectedCategories.value;
  const validation = conferenceModule.value.validateAbstract(result);
  result.complianceWarnings = [...validation.errors, ...validation.warnings];
  return result;
};

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  target.value = '';
  isLoading.value = true;
  loadingMessage.value = t('loading_messages.processing_file', { filename: file.name });
  error.value = null;
  try {
    if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
      inputText.value = await file.text();
    } else {
      const result = await fileProcessingService.processFile(file);
      if (!result.success || !result.content) throw new Error(result.error || 'file_read_failed');
      inputText.value = result.content;
    }
    resetGeneratedState();
  } catch (caught) {
    error.value = localizeError(caught, t, 'errors.file_processing_failed');
  } finally {
    isLoading.value = false;
  }
};

const handleAnalyze = async () => {
  if (!inputText.value.trim()) return;
  if (
    getManagedAnalysisRetryNotice(workflowContext.value) === 'one_free_remaining' &&
    !window.confirm(t('membership.analysis_retry_warning'))
  )
    return;
  isLoading.value = true;
  loadingMessage.value = t('loading_messages.analyzing_content');
  error.value = null;
  resetGeneratedState();
  try {
    const modelAnalysis = await llm.analyzeContentForConference(inputText.value, props.conference);
    applyClassification(inputText.value, modelAnalysis.keywords);
    isAnalysisModalOpen.value = true;
  } catch (caught) {
    generateAfterReanalysis.value = false;
    error.value = localizeError(caught, t, 'errors.analysis_failed');
  } finally {
    isLoading.value = false;
  }
};

const handleGenerate = async () => {
  if (!classification.value || !analysisConfirmed.value) return;
  if (
    !(await prepareManagedTextReentry(
      workflowContext.value,
      'regeneration',
      () => workflowReentryDialog.value?.open('regeneration') ?? Promise.resolve('cancel'),
      async () => {
        generateAfterReanalysis.value = true;
        await handleAnalyze();
      }
    ))
  )
    return;

  isLoading.value = true;
  loadingMessage.value = t('loading_messages.generating_abstract');
  error.value = null;
  try {
    const prompt = buildOncologyPrompt(
      props.conference,
      inputText.value,
      classification.value,
      'standard'
    );
    const result = await llm.generateAbstractForConference(
      prompt,
      selectedAbstractType.value,
      selectedCategories.value,
      selectedKeywords.value,
      props.conference,
      profile.value.ruleVersion,
      'generation',
      inputText.value
    );
    generatedAbstract.value = attachCompliance(result, classification.value);
  } catch (caught) {
    error.value = localizeError(caught, t, 'errors.generation_failed');
  } finally {
    isLoading.value = false;
  }
};

const handleCreative = async () => {
  if (!inputText.value.trim()) return;
  isLoading.value = true;
  loadingMessage.value = t('loading_messages.generating_creative');
  error.value = null;
  try {
    const inferred = applyClassification(inputText.value);
    const prompt = buildOncologyPrompt(props.conference, inputText.value, inferred, 'creative');
    const result = await llm.generateCreativeAbstractForConference(prompt, props.conference);
    selectedKeywords.value = result.keywords;
    generatedAbstract.value = attachCompliance(result, inferred);
  } catch (caught) {
    error.value = localizeError(caught, t, 'errors.creative_failed');
  } finally {
    isLoading.value = false;
  }
};

const handleDeepUpdate = async () => {
  if (!generatedAbstract.value || !classification.value) return;
  if (
    !(await prepareManagedTextReentry(
      workflowContext.value,
      'deep_update',
      () => workflowReentryDialog.value?.open('deep_update') ?? Promise.resolve('cancel'),
      async () => {
        generateAfterReanalysis.value = true;
        await handleAnalyze();
      }
    ))
  )
    return;

  isLoading.value = true;
  loadingMessage.value = t('loading_messages.deep_diving');
  error.value = null;
  try {
    const prompt = buildOncologyPrompt(
      props.conference,
      `${inputText.value}\n\nCurrent draft requiring high-reasoning revision:\n${generatedAbstract.value.abstract ?? ''}`,
      classification.value,
      'deep-update'
    );
    const result = await llm.generateFinalAbstract(
      prompt,
      selectedAbstractType.value,
      selectedCategories.value,
      selectedKeywords.value,
      generatedAbstract.value.impact,
      generatedAbstract.value.synopsis,
      'deep_update',
      workflowContext.value
    );
    generatedAbstract.value = attachCompliance(result, classification.value);
    deepUpdateCompleted.value = true;
  } catch (caught) {
    error.value = localizeError(caught, t, 'errors.deep_update_failed');
  } finally {
    isLoading.value = false;
  }
};

const selectCategory = (event: Event) => {
  const name = (event.target as HTMLSelectElement).value;
  selectedCategories.value = [{ name, type: 'main', probability: 1 }];
  if (classification.value) classification.value.primaryCategory = name;
};

const confirmAnalysis = () => {
  analysisConfirmed.value = true;
  isAnalysisModalOpen.value = false;
  if (generateAfterReanalysis.value) {
    generateAfterReanalysis.value = false;
    void handleGenerate();
  }
};

const cancelAnalysis = () => {
  isAnalysisModalOpen.value = false;
  analysisConfirmed.value = false;
  generateAfterReanalysis.value = false;
};

const openSaveModal = () => {
  if (!currentAbstractId.value) {
    saveTitle.value = `${props.conference} Abstract - ${new Date().toLocaleDateString()}`;
  }
  showSaveModal.value = true;
  nextTick(() => saveTitleInput.value?.focus());
};

const handleSaveAbstract = async () => {
  if (!generatedAbstract.value || !saveTitle.value.trim()) return;
  isLoading.value = true;
  loadingMessage.value = t('common.loading');
  error.value = null;
  try {
    const record = {
      title: saveTitle.value.trim(),
      conference: props.conference,
      abstractType: selectedAbstractType.value,
      abstractData: generatedAbstract.value,
      originalText: inputText.value,
      categories: selectedCategories.value,
      keywords: selectedKeywords.value,
    };
    if (currentAbstractId.value) {
      await databaseService.updateAbstract(currentAbstractId.value, record);
    } else {
      currentAbstractId.value = await databaseService.saveAbstract(record);
    }
    showSaveModal.value = false;
  } catch (caught) {
    error.value = localizeError(caught, t, 'errors.save_failed');
  } finally {
    isLoading.value = false;
  }
};

const loadAbstractData = (saved: SavedAbstract) => {
  inputText.value = saved.originalText;
  generatedAbstract.value = saved.abstractData;
  selectedCategories.value = saved.categories ?? [];
  selectedKeywords.value = saved.keywords;
  selectedAbstractType.value = saved.abstractType;
  currentAbstractId.value = saved.id;
  saveTitle.value = saved.title;
  classification.value =
    saved.abstractData.oncology ?? classifyOncologyAbstract(props.conference, saved.originalText);
};

const clearAll = () => {
  inputText.value = '';
  currentAbstractId.value = null;
  saveTitle.value = '';
  error.value = null;
  resetGeneratedState();
};

const setMode = (nextMode: GenerationMode) => {
  mode.value = nextMode;
  resetGeneratedState();
};

watch(abstractToLoad, (saved) => {
  if (saved && saved.conference === props.conference) {
    loadAbstractData(saved);
    clearLoadedAbstract();
  }
});

watch(
  () => props.conference,
  () => {
    mode.value = 'standard';
    clearAll();
  }
);
</script>
