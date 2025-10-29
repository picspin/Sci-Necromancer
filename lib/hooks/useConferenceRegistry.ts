import { useState, useEffect } from 'react';
import { Conference } from '../../types';
import { ConferenceRegistry } from '../conference/ConferenceRegistry';
import { conferenceRouter } from '../conference/ConferenceRouter';

/**
 * React hook for using the conference registry
 */
export function useConferenceRegistry() {
  const [initialized, setInitialized] = useState(ConferenceRegistry.isInitialized());
  const [activeConference, setActiveConference] = useState<Conference>(conferenceRouter.getActiveConference());
  
  useEffect(() => {
    if (!initialized) {
      ConferenceRegistry.initialize()
        .then(() => setInitialized(true))
        .catch(error => {
          console.error('Failed to initialize conference registry:', error);
        });
    }
  }, [initialized]);

  useEffect(() => {
    const handleConferenceChange = (conference: Conference) => {
      setActiveConference(conference);
    };

    conferenceRouter.addListener(handleConferenceChange);
    
    return () => {
      conferenceRouter.removeListener(handleConferenceChange);
    };
  }, []);

  const switchConference = (conference: Conference) => {
    try {
      conferenceRouter.setActiveConference(conference);
    } catch (error) {
      console.error('Failed to switch conference:', error);
      throw error;
    }
  };

  return {
    initialized,
    activeConference,
    conferenceInfo: ConferenceRegistry.getConferenceInfo(),
    availableConferences: conferenceRouter.getAvailableConferences(),
    switchConference,
    getActiveModule: () => conferenceRouter.getActiveModule(),
    getModule: (conference: Conference) => conferenceRouter.getModule(conference),
    router: conferenceRouter
  };
}