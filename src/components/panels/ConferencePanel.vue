<template>
  <div class="bg-base-200 p-2 rounded-lg shadow-lg">
    <!-- Loading State -->
    <div v-if="!initialized" class="bg-base-200 p-4 rounded-lg shadow-lg">
      <div class="flex items-center justify-center h-32">
        <div class="text-center">
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"
          ></div>
          <p class="text-text-secondary">Loading conference modules...</p>
        </div>
      </div>
    </div>

    <!-- Conference Navigation Tabs -->
    <template v-else>
      <div class="flex flex-wrap border-b border-base-300 mb-4">
        <ConferenceTab
          v-for="conference in conferenceInfo"
          :key="conference.id"
          :id="conference.id"
          :label="conference.name"
          :submission-url="conference.submissionUrl"
          :active-tab="localActiveConference"
          :disabled="!conference.available"
          :color-scheme="conference.colorScheme"
          @set-active="handleConferenceChange"
        />
        <!-- Image Generation Tab -->
        <div class="flex flex-col">
          <button
            @click="handleConferenceChange('IMAGE')"
            :class="[
              'text-sm font-medium py-3 px-4 rounded-t-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 min-w-[120px]',
              localActiveConference === 'IMAGE'
                ? 'border-b-2 text-white shadow-md'
                : 'text-text-secondary hover:bg-base-300/50 hover:text-text-primary',
              'cursor-pointer',
            ]"
            :style="{
              backgroundColor: localActiveConference === 'IMAGE' ? '#6366f1' : 'transparent',
              borderBottomColor: localActiveConference === 'IMAGE' ? '#818cf8' : 'transparent',
            }"
            title="Image Generation Panel"
          >
            <div class="flex flex-col items-center gap-1">
              <span class="font-semibold flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
                IMAGE
              </span>
              <span class="text-xs opacity-80 hidden sm:block">{{
                t('tabs.figure_generation')
              }}</span>
            </div>
          </button>
          <!-- Placeholder for alignment with other tabs that have submission links -->
          <div class="px-2 py-1 min-h-[24px]"></div>
        </div>
      </div>

      <!-- Conference Panel Content -->
      <div>
        <ISMRMPanel v-if="localActiveConference === 'ISMRM'" />
        <RSNAPanel v-if="localActiveConference === 'RSNA'" />
        <ERPanel v-if="localActiveConference === 'ER'" />
        <ESCPanel v-if="localActiveConference === 'ESC'" />
        <ImageGenerationPanel v-if="localActiveConference === 'IMAGE'" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Conference } from '@/types';
import { useConferenceRegistry } from '@/composables/useConferenceRegistry';
import ISMRMPanel from './ISMRMPanel.vue';
import RSNAPanel from './RSNAPanel.vue';
import ESCPanel from './ESCPanel.vue';
import ConferenceTab from './ConferenceTab.vue';
import ERPanel from './ERPanel.vue';
import { ImageGenerationPanel } from './ImageGenerationPanel';

const { t } = useI18n();

const { initialized, activeConference, conferenceInfo, switchConference } = useConferenceRegistry();
const localActiveConference = ref<Conference>('ISMRM');

// Sync with conference registry
watch(
  () => [initialized.value, activeConference.value],
  () => {
    if (initialized.value) {
      localActiveConference.value = activeConference.value;
    }
  },
  { immediate: true }
);

const handleConferenceChange = (conference: Conference) => {
  // IMAGE tab doesn't need conference registry switch
  if (conference === 'IMAGE') {
    localActiveConference.value = conference;
    return;
  }

  try {
    switchConference(conference);
    localActiveConference.value = conference;
  } catch (error) {
    console.error('Failed to switch conference:', error);
  }
};
</script>
