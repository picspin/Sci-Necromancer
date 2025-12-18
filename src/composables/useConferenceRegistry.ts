import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { Conference } from '@/types';
import { ConferenceRegistry } from '@/lib/conference/ConferenceRegistry';
import { conferenceRouter } from '@/lib/conference/ConferenceRouter';

/**
 * Vue composable for using the conference registry
 */
export function useConferenceRegistry() {
  const initialized = ref(ConferenceRegistry.isInitialized());
  const activeConference = ref<Conference>(conferenceRouter.getActiveConference());

  let listenerCleanup: (() => void) | null = null;

  onMounted(async () => {
    // Initialize registry if needed
    if (!initialized.value) {
      try {
        await ConferenceRegistry.initialize();
        initialized.value = true;
      } catch (error) {
        console.error('Failed to initialize conference registry:', error);
      }
    }

    // Listen for conference changes
    const handleConferenceChange = (conference: Conference) => {
      activeConference.value = conference;
    };

    conferenceRouter.addListener(handleConferenceChange);

    listenerCleanup = () => {
      conferenceRouter.removeListener(handleConferenceChange);
    };
  });

  onUnmounted(() => {
    if (listenerCleanup) {
      listenerCleanup();
    }
  });

  const switchConference = (conference: Conference) => {
    try {
      conferenceRouter.setActiveConference(conference);
    } catch (error) {
      console.error('Failed to switch conference:', error);
      throw error;
    }
  };

  return {
    initialized: computed(() => initialized.value),
    activeConference: computed(() => activeConference.value),
    conferenceInfo: ConferenceRegistry.getConferenceInfo(),
    availableConferences: conferenceRouter.getAvailableConferences(),
    switchConference,
    getActiveModule: () => conferenceRouter.getActiveModule(),
    getModule: (conference: Conference) => conferenceRouter.getModule(conference),
    router: conferenceRouter,
  };
}
