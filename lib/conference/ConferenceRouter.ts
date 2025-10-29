import { Conference, ConferenceModule } from '../../types';

/**
 * Conference Router manages the active conference and provides access to conference modules
 */
export class ConferenceRouter {
  private static instance: ConferenceRouter;
  private activeConference: Conference = 'ISMRM';
  private modules: Map<Conference, ConferenceModule> = new Map();
  private listeners: Set<(conference: Conference) => void> = new Set();

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ConferenceRouter {
    if (!ConferenceRouter.instance) {
      ConferenceRouter.instance = new ConferenceRouter();
    }
    return ConferenceRouter.instance;
  }

  /**
   * Register a conference module
   */
  registerModule(module: ConferenceModule): void {
    this.modules.set(module.id, module);
  }

  /**
   * Get a conference module by ID
   */
  getModule(conference: Conference): ConferenceModule | undefined {
    return this.modules.get(conference);
  }

  /**
   * Get the active conference module
   */
  getActiveModule(): ConferenceModule | undefined {
    return this.modules.get(this.activeConference);
  }

  /**
   * Set the active conference
   */
  setActiveConference(conference: Conference): void {
    if (this.activeConference !== conference) {
      const module = this.modules.get(conference);
      if (module && module.isAvailable()) {
        this.activeConference = conference;
        this.notifyListeners(conference);
      } else {
        throw new Error(`Conference module ${conference} is not available`);
      }
    }
  }

  /**
   * Get the current active conference
   */
  getActiveConference(): Conference {
    return this.activeConference;
  }

  /**
   * Get all registered conferences
   */
  getAvailableConferences(): Conference[] {
    return Array.from(this.modules.keys()).filter(conference => {
      const module = this.modules.get(conference);
      return module?.isAvailable() ?? false;
    });
  }

  /**
   * Get all registered modules
   */
  getAllModules(): Map<Conference, ConferenceModule> {
    return new Map(this.modules);
  }

  /**
   * Check if a conference is available
   */
  isConferenceAvailable(conference: Conference): boolean {
    const module = this.modules.get(conference);
    return module?.isAvailable() ?? false;
  }

  /**
   * Add a listener for conference changes
   */
  addListener(listener: (conference: Conference) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(listener: (conference: Conference) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of conference change
   */
  private notifyListeners(conference: Conference): void {
    this.listeners.forEach(listener => {
      try {
        listener(conference);
      } catch (error) {
        console.error('Error in conference change listener:', error);
      }
    });
  }

  /**
   * Load a conference module dynamically (for lazy loading)
   */
  async loadModule(conference: Conference): Promise<ConferenceModule> {
    const existingModule = this.modules.get(conference);
    if (existingModule) {
      return existingModule;
    }

    try {
      // Dynamic import based on conference
      let ModuleClass;
      switch (conference) {
        case 'ISMRM':
          const ismrmModule = await import('./modules/ISMRMModule');
          ModuleClass = ismrmModule.ISMRMModule;
          break;
        case 'RSNA':
          const rsnaModule = await import('./modules/RSNAModule');
          ModuleClass = rsnaModule.RSNAModule;
          break;
        case 'JACC':
          const jaccModule = await import('./modules/JACCModule');
          ModuleClass = jaccModule.JACCModule;
          break;
        case 'ER':
          const erModule = await import('./modules/ERModule');
          ModuleClass = erModule.ERModule;
          break;
        default:
          throw new Error(`Unknown conference: ${conference}`);
      }

      const module = new ModuleClass();
      this.registerModule(module);
      return module;
    } catch (error) {
      console.error(`Failed to load ${conference} module:`, error);
      throw new Error(`Failed to load ${conference} module: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Preload all available modules
   */
  async preloadAllModules(): Promise<void> {
    const conferences: Conference[] = ['ISMRM', 'RSNA', 'JACC', 'ER'];
    
    await Promise.allSettled(
      conferences.map(async (conference) => {
        try {
          await this.loadModule(conference);
        } catch (error) {
          console.warn(`Failed to preload ${conference} module:`, error);
        }
      })
    );
  }

  /**
   * Reset the router (mainly for testing)
   */
  reset(): void {
    this.modules.clear();
    this.listeners.clear();
    this.activeConference = 'ISMRM';
  }
}

// Export singleton instance
export const conferenceRouter = ConferenceRouter.getInstance();