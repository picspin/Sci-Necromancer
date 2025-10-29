import { Conference } from '../../types';
import { conferenceRouter } from './ConferenceRouter';

/**
 * Conference Registry manages the registration and initialization of conference modules
 */
export class ConferenceRegistry {
  private static initialized = false;

  /**
   * Initialize all conference modules
   */
  static async initialize(): Promise<void> {
    if (ConferenceRegistry.initialized) {
      return;
    }

    try {
      // Load and register all available modules
      await conferenceRouter.preloadAllModules();
      
      ConferenceRegistry.initialized = true;
      console.log('Conference modules initialized successfully');
    } catch (error) {
      console.error('Failed to initialize conference modules:', error);
      throw error;
    }
  }

  /**
   * Get conference module information
   */
  static getConferenceInfo(): Array<{
    id: Conference;
    name: string;
    submissionUrl: string;
    available: boolean;
    colorScheme: { primary: string; secondary: string; accent: string };
  }> {
    const modules = conferenceRouter.getAllModules();
    const conferences: Conference[] = ['ISMRM', 'RSNA', 'JACC', 'ER'];
    
    return conferences.map(conference => {
      const module = modules.get(conference);
      return {
        id: conference,
        name: module?.name || conference,
        submissionUrl: module?.submissionUrl || '#',
        available: module?.isAvailable() ?? false,
        colorScheme: module?.getColorScheme() || { primary: '#9E9E9E', secondary: '#BDBDBD', accent: '#616161' }
      };
    });
  }

  /**
   * Check if registry is initialized
   */
  static isInitialized(): boolean {
    return ConferenceRegistry.initialized;
  }

  /**
   * Reset registry (for testing)
   */
  static reset(): void {
    ConferenceRegistry.initialized = false;
    conferenceRouter.reset();
  }
}

/**
 * Hook for React components to use conference registry
 */
export function useConferenceRegistry() {
  // This will be implemented in a separate React hook file
  // to avoid importing React in this utility file
  throw new Error('useConferenceRegistry hook should be imported from lib/hooks/useConferenceRegistry');
}

// Auto-initialize on import (can be disabled for testing)
if (typeof window !== 'undefined' && !ConferenceRegistry.isInitialized()) {
  ConferenceRegistry.initialize().catch(console.error);
}