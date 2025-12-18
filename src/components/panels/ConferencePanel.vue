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
      </div>

      <!-- Conference Panel Content -->
      <div>
        <ISMRMPanel v-if="localActiveConference === 'ISMRM'" />
        <RSNAPanel v-if="localActiveConference === 'RSNA'" />
        <JACCPanel v-if="localActiveConference === 'JACC'" />
        <ERPanel v-if="localActiveConference === 'ER'" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Conference } from '@/types';
import { useConferenceRegistry } from '@/composables/useConferenceRegistry';
import ISMRMPanel from './ISMRMPanel.vue';
import RSNAPanel from './RSNAPanel.vue';
import JACCPanel from './JACCPanel.vue';
import ConferenceTab from './ConferenceTab.vue';

// Placeholder for ER Panel
const ERPanel = {
  template: `
    <div class="flex items-center justify-center h-64 bg-base-100 rounded-lg">
      <div class="text-center">
        <h3 class="text-lg font-semibold text-text-primary mb-2">European Radiology</h3>
        <p class="text-text-secondary">Coming Soon</p>
        <p class="text-sm text-text-secondary mt-2">
          This module is under development and will be available in a future update.
        </p>
      </div>
    </div>
  `,
};

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
  try {
    switchConference(conference);
    localActiveConference.value = conference;
  } catch (error) {
    console.error('Failed to switch conference:', error);
  }
};
</script>
