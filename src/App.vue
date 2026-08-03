<template>
  <div class="min-h-screen bg-base-100">
    <!-- Header -->
    <header class="bg-base-200 border-b border-base-300 py-4 px-6">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <SvgIcon type="logo" class="h-8 w-8 text-brand-primary" />
          <h1 class="text-2xl font-bold text-brand-primary">
            {{ getMemeTranslation('Sci-Evil', t) || t('header.title') }}
          </h1>
        </div>
        <div class="flex items-center gap-4">
          <button
            @click="showMemberPanel = true"
            class="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
            :title="t('membership.title')"
          >
            <span aria-hidden="true">◉</span>
            <span class="hidden sm:inline">
              {{
                isAuthenticated
                  ? `${memberStatus?.bonusBalance ?? 0} ${t('membership.credit_unit')}`
                  : t('header.sign_in')
              }}
            </span>
          </button>
          <!-- Abstract Manager -->
          <button
            @click="showAbstractManager = true"
            class="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
            :title="t('tooltips.abstract_manager')"
          >
            <SvgIcon type="document" class="h-5 w-5" />
            <span class="hidden sm:inline">{{ t('header.abstracts') }}</span>
          </button>

          <!-- Model Manager -->
          <button
            @click="showModelManager = true"
            class="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
            :title="t('tooltips.model_settings')"
          >
            <SvgIcon type="settings" class="h-5 w-5" />
            <span class="hidden sm:inline">{{ t('header.models') }}</span>
          </button>

          <!-- GitHub Link -->
          <GitHubRepoLink
            :show-label="false"
            class="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
          />

          <!-- Language Selector -->
          <LanguageSelector />
        </div>
      </div>
    </header>

    <AIDisclosure />

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-6 py-8">
      <!-- Conference Panel with integrated navigation -->
      <ConferencePanel />
    </main>

    <!-- Abstract Manager Modal -->
    <AbstractManager
      v-if="showAbstractManager"
      :is-visible="showAbstractManager"
      @close="showAbstractManager = false"
    />

    <!-- Model Manager Modal -->
    <ModelManager
      v-if="showModelManager"
      :initial-panel="modelManagerInitialPanel"
      @close="showModelManager = false"
      @open-member="openMemberAccount"
    />

    <MemberPanel v-if="showMemberPanel" @close="showMemberPanel = false" />

    <!-- Notification Display -->
    <NotificationDisplay />

    <!-- Right-bottom Help & Configuration Guide Accessory -->
    <button
      ref="helpLauncher"
      @click="showHelp = true"
      class="fixed bottom-4 right-4 z-40 px-4 py-2 bg-brand-primary text-white rounded-full shadow-lg hover:bg-brand-secondary focus:outline-none focus:ring-3 focus:ring-brand-primary"
      :title="t('help_assistant.open')"
      :aria-label="t('help_assistant.open')"
      type="button"
    >
      <span class="inline-flex items-center gap-2">
        <SvgIcon type="info" class="h-5 w-5" />
        <span class="hidden sm:inline">{{ t('help_assistant.title') }}</span>
      </span>
    </button>

    <DocumentationAssistant
      :is-open="showHelp"
      :authenticated="isAuthenticated"
      :page-context="helpPageContext"
      :turnstile-site-key="turnstileSiteKey"
      :ask="askDocumentationAssistant"
      @close="closeHelp"
      @navigate="handleHelpNavigation"
    />

    <!-- Footer -->
    <footer class="bg-base-200 border-t border-base-300 py-4 px-6 mt-12">
      <div class="max-w-7xl mx-auto text-center text-text-secondary text-sm">
        <p>{{ t('footer.copyright') }}</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMemeTranslation } from '@/lib/i18n';
import ConferencePanel from '@/components/panels/ConferencePanel.vue';
import AbstractManager from '@/components/managers/AbstractManager.vue';
import ModelManager from '@/components/managers/ModelManager.vue';
import DocumentationAssistant from '@/components/help/DocumentationAssistant.vue';
import NotificationDisplay from '@/components/ui/NotificationDisplay.vue';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';
import AIDisclosure from '@/components/ui/AIDisclosure.vue';
import GitHubRepoLink from '@/components/ui/GitHubRepoLink.vue';
import MemberPanel from '@/components/membership/MemberPanel.vue';
import { useMembership } from '@/composables/useMembership';
import { createHelpAssistantClient } from '@/src/services/helpAssistantClient';
import { resolveGuidedNavigation, type HelpPageContext } from '@/lib/help/helpCatalog';

const { t, locale } = useI18n();
const showAbstractManager = ref(false);
const showModelManager = ref(false);
const showHelp = ref(false);
const showMemberPanel = ref(false);
const modelManagerInitialPanel = ref<'member-services' | 'personal-api' | 'skills-mcp'>(
  'member-services'
);
const helpLauncher = ref<HTMLButtonElement | null>(null);
const membership = useMembership();
const {
  initialize,
  isAuthenticated,
  status: memberStatus,
  getAccessToken,
  turnstileSiteKey,
} = membership;
const helpClient = createHelpAssistantClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || window.location.origin,
  getAccessToken,
});

const helpPageContext = computed<HelpPageContext>(() => {
  let settings: Record<string, any> = {};
  try {
    settings = JSON.parse(localStorage.getItem('app-settings') || '{}');
  } catch {
    settings = {};
  }
  const provider = ['google', 'openai', 'anthropic'].includes(settings.provider)
    ? settings.provider
    : 'google';
  return {
    authenticated: isAuthenticated.value,
    provider,
    textApiConfigured:
      provider === 'google'
        ? Boolean(settings.googleApiKey && settings.model)
        : provider === 'openai'
          ? Boolean(settings.openAIApiKey && settings.openAITextModel)
          : Boolean(settings.anthropicApiKey && settings.anthropicTextModel),
    imageApiConfigured:
      provider === 'google'
        ? Boolean(settings.googleApiKey && settings.googleImageModel)
        : provider === 'openai'
          ? Boolean(settings.openAIApiKey && settings.openAIImageModel)
          : false,
    managedTextEnabled: Boolean(settings.memberManagedTextEnabled),
    managedImageEnabled: Boolean(
      settings.memberManagedNanoBananaEnabled || settings.memberManagedGptImageEnabled
    ),
    baseUrlKind:
      (provider === 'openai' && settings.openAIBaseUrl) ||
      (provider === 'anthropic' && settings.anthropicBaseUrl)
        ? 'custom'
        : 'official',
  };
});

onMounted(() => void initialize());

function openMemberAccount() {
  showModelManager.value = false;
  showMemberPanel.value = true;
}

function askDocumentationAssistant(input: {
  question: string;
  signal?: AbortSignal;
  turnstileToken?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  return helpClient.ask({
    ...input,
    locale: locale.value.toLowerCase().startsWith('zh') ? 'zh' : 'en',
    context: helpPageContext.value,
  });
}

function closeHelp() {
  showHelp.value = false;
  void nextTick(() => helpLauncher.value?.focus());
}

function handleHelpNavigation(shortcutId: string) {
  const action = resolveGuidedNavigation(shortcutId);
  if (!action) return;
  showHelp.value = false;
  if (action.destination === 'model-settings') {
    modelManagerInitialPanel.value = action.panel || 'personal-api';
    showModelManager.value = true;
    return;
  }
  if (action.destination === 'member-panel') {
    showMemberPanel.value = true;
    return;
  }
  if (action.destination === 'abstract-manager') {
    showAbstractManager.value = true;
    return;
  }
  if (action.destination === 'github-issues') {
    window.open('https://github.com/picspin/Sci-Necromancer/issues/new', '_blank', 'noopener');
    return;
  }
  void nextTick(() => {
    const selector =
      action.destination === 'blind-review' ? '[data-help-target="blind-review"]' : 'main';
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  });
}
</script>
