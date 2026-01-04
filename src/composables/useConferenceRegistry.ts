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
  // Force re-computation when initialized changes
  const updateTrigger = ref(0);

  let listenerCleanup: (() => void) | null = null;

  onMounted(async () => {
    // Initialize registry if needed
    if (!initialized.value) {
      try {
        await ConferenceRegistry.initialize();
        initialized.value = true;
        updateTrigger.value++; // Trigger re-computation
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

  // Make conferenceInfo reactive by using computed
  const conferenceInfo = computed(() => {
    // Depend on updateTrigger and initialized to re-compute
    const _ = updateTrigger.value;
    if (!initialized.value) {
      // Return default placeholder data when not initialized
      const defaultColorScheme = { primary: '#9E9E9E', secondary: '#BDBDBD', accent: '#616161' };
      return [
        {
          id: 'ISMRM' as Conference,
          name: 'ISMRM Abstract Assistant',
          submissionUrl: '#',
          available: false,
          colorScheme: defaultColorScheme,
        },
        {
          id: 'RSNA' as Conference,
          name: 'RSNA Radiology',
          submissionUrl: '#',
          available: false,
          colorScheme: defaultColorScheme,
        },
        {
          id: 'ER' as Conference,
          name: 'ER ECR',
          submissionUrl: '#',
          available: false,
          colorScheme: defaultColorScheme,
        },
        {
          id: 'ESC' as Conference,
          name: 'ESC Congress',
          submissionUrl: '#',
          available: false,
          colorScheme: defaultColorScheme,
        },
      ];
    }
    return ConferenceRegistry.getConferenceInfo();
  });

  return {
    initialized: computed(() => initialized.value),
    activeConference: computed(() => activeConference.value),
    conferenceInfo,
    availableConferences: computed(() => conferenceRouter.getAvailableConferences()),
    switchConference,
    getActiveModule: () => conferenceRouter.getActiveModule(),
    getModule: (conference: Conference) => conferenceRouter.getModule(conference),
    router: conferenceRouter,
  };
}
