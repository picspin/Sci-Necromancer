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
          <a
            href="https://github.com/yourusername/sci-evil"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
            :title="t('tooltips.github_repo')"
          >
            <SvgIcon type="github" class="h-5 w-5" />
          </a>

          <!-- Language Selector -->
          <LanguageSelector />
        </div>
      </div>
    </header>

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
    <ModelManager v-if="showModelManager" @close="showModelManager = false" />

    <!-- Notification Display -->
    <NotificationDisplay />

    <!-- Footer -->
    <footer class="bg-base-200 border-t border-base-300 py-4 px-6 mt-12">
      <div class="max-w-7xl mx-auto text-center text-text-secondary text-sm">
        <p>{{ t('footer.copyright') }}</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMemeTranslation } from '@/lib/i18n';
import ConferencePanel from '@/components/panels/ConferencePanel.vue';
import AbstractManager from '@/components/managers/AbstractManager.vue';
import ModelManager from '@/components/managers/ModelManager.vue';
import NotificationDisplay from '@/components/ui/NotificationDisplay.vue';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';

const { t } = useI18n();
const showAbstractManager = ref(false);
const showModelManager = ref(false);
</script>
