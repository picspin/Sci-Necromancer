<template>
  <section
    ref="dialogRef"
    v-show="isOpen"
    class="documentation-assistant fixed bottom-4 right-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200 shadow-2xl"
    role="dialog"
    aria-modal="false"
    :aria-label="t('help_assistant.title')"
    @keydown.esc="emit('close')"
    @keydown.tab="containFocus"
  >
    <header class="flex items-center justify-between border-b border-base-300 px-4 py-3">
      <div>
        <h2 class="font-semibold text-text-primary">{{ t('help_assistant.title') }}</h2>
        <p class="text-xs text-text-secondary">{{ t('help_assistant.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="messages.length || pendingQuestion"
          type="button"
          class="min-h-11 rounded-lg px-2 text-xs text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          @click="startNewConversation"
        >
          {{ t('help_assistant.new_conversation') }}
        </button>
        <button
          type="button"
          class="grid min-h-11 min-w-11 place-items-center rounded-lg text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          :aria-label="t('help_assistant.close')"
          @click="emit('close')"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </header>

    <div class="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
      <div class="rounded-xl bg-base-100 p-3 text-sm text-text-secondary">
        {{ t('help_assistant.welcome') }}
      </div>

      <div v-if="messages.length === 0" class="grid gap-2">
        <button
          v-for="question in suggestedQuestions"
          :key="question.id"
          data-testid="help-suggested-question"
          type="button"
          class="min-h-11 rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-left text-sm text-text-primary hover:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          @click="answerShortcut(question)"
        >
          {{ question.label }}
        </button>
        <button
          type="button"
          class="min-h-11 rounded-xl px-3 py-2 text-sm text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          :aria-expanded="showTopics"
          @click="showTopics = !showTopics"
        >
          {{ t('help_assistant.browse_topics') }}
        </button>
        <div v-if="showTopics" class="grid gap-2 border-t border-base-300 pt-2">
          <button
            v-for="article in allArticles"
            :key="article.id"
            data-testid="help-topic"
            type="button"
            class="min-h-11 rounded-lg bg-base-100 px-3 py-2 text-left text-sm text-text-primary"
            @click="openArticle(article.id)"
          >
            <strong>{{ article.title }}</strong>
            <small class="mt-1 block text-text-secondary">{{ article.summary }}</small>
          </button>
        </div>
      </div>

      <article v-for="message in messages" :key="message.id" class="space-y-2">
        <p class="rounded-xl bg-brand-primary/10 p-3 text-sm text-text-primary">
          {{ message.question }}
        </p>
        <div class="rounded-xl bg-base-100 p-3 text-sm leading-relaxed text-text-secondary">
          <span
            v-if="message.mode === 'assisted'"
            class="mb-2 inline-flex rounded-full bg-brand-primary/10 px-2 py-1 text-[11px] text-brand-primary"
          >
            {{ t('help_assistant.ai_answer') }}
          </span>
          <p>
            {{ message.answer }}
          </p>
        </div>
        <details v-if="message.citations?.length" class="rounded-lg bg-base-100 px-3 py-2 text-xs">
          <summary class="cursor-pointer text-text-secondary">
            {{ t('help_assistant.sources') }}
          </summary>
          <ul class="mt-2 space-y-1 text-text-secondary">
            <li v-for="citation in message.citations" :key="citation.articleId">
              {{ citation.title }}
              <span v-if="citation.lastVerified"> · {{ citation.lastVerified }}</span>
            </li>
          </ul>
        </details>
        <div v-if="message.shortcuts.length" class="flex flex-wrap gap-2">
          <button
            v-for="shortcut in message.shortcuts"
            :key="shortcut"
            type="button"
            class="min-h-11 rounded-lg border border-brand-primary/50 px-3 py-2 text-xs text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            @click="emit('navigate', shortcut)"
          >
            {{ t(`help_assistant.shortcuts.${shortcut}`) }}
          </button>
        </div>
        <div v-if="!message.resolved" class="flex items-center gap-3 text-xs text-text-secondary">
          <span>{{ t('help_assistant.was_helpful') }}</span>
          <button type="button" class="min-h-11 px-2" @click="message.resolved = true">
            {{ t('help_assistant.resolved') }}
          </button>
          <button type="button" class="min-h-11 px-2" @click="reportUnresolved(message)">
            {{ t('help_assistant.not_resolved') }}
          </button>
        </div>
      </article>

      <div
        v-if="pendingQuestion"
        class="space-y-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-text-secondary"
      >
        <p>{{ t('help_assistant.ai_disclosure') }}</p>
        <button
          type="button"
          class="min-h-11 rounded-lg bg-brand-primary px-3 py-2 font-semibold text-white"
          @click="acceptDisclosure"
        >
          {{ t('help_assistant.accept_disclosure') }}
        </button>
      </div>

      <div
        v-if="needsTurnstile"
        class="space-y-3 rounded-xl border border-base-300 bg-base-100 p-3"
      >
        <p class="text-sm text-text-secondary">{{ t('help_assistant.verification_required') }}</p>
        <TurnstileChallenge :site-key="turnstileSiteKey || ''" @token="turnstileToken = $event" />
        <button
          type="button"
          class="min-h-11 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="!turnstileToken"
          @click="retryAfterTurnstile"
        >
          {{ t('help_assistant.retry') }}
        </button>
      </div>

      <p v-if="errorMessage" role="alert" class="text-sm text-red-400">{{ errorMessage }}</p>
      <p v-if="isLoading" role="status" class="text-sm text-text-secondary">
        {{ t('help_assistant.thinking') }}
      </p>
      <p v-if="dailyRemaining !== null" class="text-xs text-text-secondary">
        {{ t('help_assistant.remaining', { count: dailyRemaining }) }}
      </p>
    </div>

    <form class="flex gap-2 border-t border-base-300 p-3" @submit.prevent="submitQuestion">
      <label class="sr-only" for="documentation-assistant-question">
        {{ t('help_assistant.question_label') }}
      </label>
      <textarea
        ref="questionField"
        id="documentation-assistant-question"
        v-model.trim="questionInput"
        maxlength="1000"
        rows="2"
        class="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
        :placeholder="t('help_assistant.question_placeholder')"
        :disabled="isLoading"
      />
      <button
        v-if="!isLoading"
        type="submit"
        class="min-h-11 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        :disabled="!questionInput"
      >
        {{ t('help_assistant.ask') }}
      </button>
      <button
        v-else
        type="button"
        class="min-h-11 rounded-xl border border-base-300 px-3 py-2 text-sm text-text-primary"
        @click="stopAnswer"
      >
        {{ t('help_assistant.stop') }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  getSuggestedHelpQuestions,
  listHelpArticles,
  searchHelpCatalog,
  type HelpPageContext,
  type SuggestedHelpQuestion,
} from '@/lib/help/helpCatalog';
import { validateHelpQuestion } from '@/lib/help/helpSafety';
import TurnstileChallenge from '@/components/membership/TurnstileChallenge.vue';

interface HelpResponse {
  mode: 'shortcut' | 'assisted' | 'fallback';
  text: string;
  citations?: Array<{ articleId: string; title: string; lastVerified?: string }>;
  shortcuts?: string[];
  remaining?: number;
}

interface Props {
  isOpen: boolean;
  authenticated: boolean;
  pageContext: HelpPageContext;
  turnstileSiteKey?: string;
  ask?: (input: {
    question: string;
    signal?: AbortSignal;
    turnstileToken?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) => Promise<HelpResponse>;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: []; navigate: [shortcutId: string] }>();
const { t, locale } = useI18n();
const helpLocale = computed(() => (locale.value.toLowerCase().startsWith('zh') ? 'zh' : 'en'));
const suggestedQuestions = computed(() =>
  getSuggestedHelpQuestions(helpLocale.value, {
    ...props.pageContext,
    authenticated: props.authenticated,
  })
);
const allArticles = computed(() => listHelpArticles(helpLocale.value));
const showTopics = ref(false);
const messages = ref<
  Array<{
    id: string;
    question: string;
    answer: string;
    citations: HelpResponse['citations'];
    shortcuts: string[];
    mode: HelpResponse['mode'];
    resolved: boolean;
  }>
>([]);
const questionInput = ref('');
const pendingQuestion = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const needsTurnstile = ref(false);
const turnstileToken = ref('');
const retryQuestion = ref('');
const dailyRemaining = ref<number | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const questionField = ref<HTMLTextAreaElement | null>(null);
let activeController: AbortController | null = null;

const disclosureAccepted = () => sessionStorage.getItem('help-ai-disclosure') === 'accepted';

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) void nextTick(() => questionField.value?.focus());
  },
  { immediate: true }
);

function containFocus(event: KeyboardEvent) {
  const focusable = Array.from(
    dialogRef.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'
    ) || []
  ).filter((element) => element.offsetParent !== null || import.meta.env.MODE === 'test');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function answerShortcut(question: SuggestedHelpQuestion) {
  const article = listHelpArticles(helpLocale.value).find(({ id }) => id === question.articleId);
  if (!article) return;
  messages.value.push({
    id: `${question.id}-${Date.now()}`,
    question: question.label,
    answer: article.body,
    citations: [
      { articleId: article.id, title: article.title, lastVerified: article.lastVerified },
    ],
    shortcuts: [question.shortcutId],
    mode: 'shortcut',
    resolved: false,
  });
}

function openArticle(articleId: string) {
  const article = allArticles.value.find(({ id }) => id === articleId);
  if (!article) return;
  messages.value.push({
    id: `article-${article.id}-${Date.now()}`,
    question: article.title,
    answer: article.body,
    citations: [
      { articleId: article.id, title: article.title, lastVerified: article.lastVerified },
    ],
    shortcuts: article.shortcuts,
    mode: 'shortcut',
    resolved: false,
  });
}

function submitQuestion() {
  const question = questionInput.value.trim();
  if (!question) return;
  const validationError = validateHelpQuestion(question);
  if (validationError) {
    errorMessage.value = t(`help_assistant.errors.${validationError}`);
    return;
  }
  errorMessage.value = '';
  const localResult = searchHelpCatalog({
    locale: helpLocale.value,
    query: question,
    context: props.pageContext,
  });
  if (localResult.mode === 'shortcut' && localResult.articles.length) {
    const article = localResult.articles[0];
    messages.value.push({
      id: `shortcut-${Date.now()}`,
      question,
      answer: article.body,
      citations: localResult.articles.map(({ id, title, lastVerified }) => ({
        articleId: id,
        title,
        lastVerified,
      })),
      shortcuts: localResult.shortcuts,
      mode: 'shortcut',
      resolved: false,
    });
    questionInput.value = '';
    return;
  }
  if (!disclosureAccepted()) {
    pendingQuestion.value = question;
    return;
  }
  void sendAssisted(question);
}

function acceptDisclosure() {
  sessionStorage.setItem('help-ai-disclosure', 'accepted');
  const question = pendingQuestion.value;
  pendingQuestion.value = '';
  if (question) void sendAssisted(question);
}

async function sendAssisted(question: string, verificationToken?: string) {
  if (!props.ask) {
    errorMessage.value = t('help_assistant.unavailable');
    return;
  }
  isLoading.value = true;
  errorMessage.value = '';
  activeController = new AbortController();
  try {
    const history = messages.value.slice(-6).flatMap((message) => [
      { role: 'user' as const, content: message.question },
      { role: 'assistant' as const, content: message.answer },
    ]);
    const result = await props.ask({
      question,
      signal: activeController.signal,
      history,
      ...(verificationToken ? { turnstileToken: verificationToken } : {}),
    });
    messages.value.push({
      id: `assisted-${Date.now()}`,
      question,
      answer: result.text,
      citations: result.citations || [],
      shortcuts: result.shortcuts || [],
      mode: result.mode,
      resolved: false,
    });
    if (typeof result.remaining === 'number') dailyRemaining.value = result.remaining;
    questionInput.value = '';
    needsTurnstile.value = false;
    turnstileToken.value = '';
    retryQuestion.value = '';
  } catch (error) {
    if ((error as Error)?.message === 'turnstile_required') {
      needsTurnstile.value = true;
      retryQuestion.value = question;
      errorMessage.value = '';
    } else if ((error as Error)?.name !== 'AbortError') {
      errorMessage.value = error instanceof Error ? error.message : t('help_assistant.unavailable');
    }
  } finally {
    isLoading.value = false;
    activeController = null;
  }
}

function stopAnswer() {
  activeController?.abort();
}

function startNewConversation() {
  activeController?.abort();
  messages.value = [];
  questionInput.value = '';
  pendingQuestion.value = '';
  errorMessage.value = '';
  needsTurnstile.value = false;
  turnstileToken.value = '';
  retryQuestion.value = '';
  dailyRemaining.value = null;
  showTopics.value = false;
}

function retryAfterTurnstile() {
  if (!retryQuestion.value || !turnstileToken.value) return;
  void sendAssisted(retryQuestion.value, turnstileToken.value);
}

function reportUnresolved(message: (typeof messages.value)[number]) {
  message.resolved = true;
  emit('navigate', 'open-github-issues');
}
</script>

<style scoped>
.documentation-assistant {
  width: min(420px, calc(100vw - 2rem));
  height: min(640px, calc(100dvh - 2rem));
}

@media (max-width: 640px) {
  .documentation-assistant {
    inset: auto 0 0;
    width: 100vw;
    height: min(92dvh, 760px);
    padding-bottom: env(safe-area-inset-bottom);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
}
</style>
