import type { Conference } from '../../types';

/**
 * Guideline configuration for each conference
 */
interface GuidelineConfig {
  conference: Conference;
  fileName: string;
  fallbackUrl?: string;
}

/**
 * GuidelineService - Manages async loading of conference guidelines
 *
 * Currently supports:
 * - Loading from local files (public folder)
 * - Future: Loading from backend database via API
 *
 * Architecture for future database integration:
 * 1. Check localStorage cache first (with TTL)
 * 2. If cache miss, fetch from database API
 * 3. Fallback to local file if API unavailable
 * 4. Store fetched content in localStorage cache
 */
export class GuidelineService {
  private static cache: Map<Conference, { content: string; timestamp: number }> = new Map();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Guideline file configurations
   */
  private static readonly configs: GuidelineConfig[] = [
    { conference: 'ISMRM', fileName: 'ISMRM-abstract-submission-guidelines.md' },
    { conference: 'RSNA', fileName: 'RSNA-abstract-submission-guidelines.md' },
    { conference: 'ER', fileName: 'ER-abstract-submission-guidelines.md' },
    { conference: 'ESC', fileName: 'ESC-congress-abstract-submission-guide.md' },
  ];

  /**
   * Load guideline for a specific conference
   * @param conference - The conference ID
   * @returns Promise<string> - The guideline content
   */
  static async loadGuideline(conference: Conference): Promise<string> {
    // Check memory cache first
    const cached = this.cache.get(conference);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.content;
    }

    // Check localStorage cache
    const localCached = this.loadFromLocalStorage(conference);
    if (localCached) {
      this.cache.set(conference, { content: localCached, timestamp: Date.now() });
      return localCached;
    }

    // Try to load from API (future database integration)
    try {
      const apiContent = await this.loadFromAPI(conference);
      if (apiContent) {
        this.saveToLocalStorage(conference, apiContent);
        this.cache.set(conference, { content: apiContent, timestamp: Date.now() });
        return apiContent;
      }
    } catch (error) {
      console.log(`API load failed for ${conference}, falling back to local file`);
    }

    // Fallback to local file
    const fileContent = await this.loadFromFile(conference);
    if (fileContent) {
      this.saveToLocalStorage(conference, fileContent);
      this.cache.set(conference, { content: fileContent, timestamp: Date.now() });
      return fileContent;
    }

    throw new Error(`Failed to load guideline for ${conference}`);
  }

  /**
   * Load guideline from backend API (placeholder for future implementation)
   */
  private static async loadFromAPI(_conference: Conference): Promise<string | null> {
    // Future implementation: Fetch from backend database
    // Example:
    // const response = await fetch(`/api/guidelines/${conference}`);
    // if (response.ok) {
    //   const data = await response.json();
    //   return data.content;
    // }

    // Currently returns null to fallback to file loading
    return null;
  }

  /**
   * Load guideline from local file in public folder
   */
  private static async loadFromFile(conference: Conference): Promise<string | null> {
    const config = this.configs.find((c) => c.conference === conference);
    if (!config) {
      return null;
    }

    try {
      const response = await fetch(`/${config.fileName}`);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.warn(`Failed to load guideline file for ${conference}:`, error);
    }

    return null;
  }

  /**
   * Load from localStorage cache
   */
  private static loadFromLocalStorage(conference: Conference): string | null {
    try {
      const key = `guideline_${conference}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const { content, timestamp } = JSON.parse(stored);
        if (Date.now() - timestamp < this.CACHE_TTL) {
          return content;
        }
        // Cache expired, remove it
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
    return null;
  }

  /**
   * Save to localStorage cache
   */
  private static saveToLocalStorage(conference: Conference, content: string): void {
    try {
      const key = `guideline_${conference}`;
      const data = JSON.stringify({ content, timestamp: Date.now() });
      localStorage.setItem(key, data);
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Clear cache for a specific conference or all conferences
   */
  static clearCache(conference?: Conference): void {
    if (conference) {
      this.cache.delete(conference);
      localStorage.removeItem(`guideline_${conference}`);
    } else {
      this.cache.clear();
      this.configs.forEach((config) => {
        localStorage.removeItem(`guideline_${config.conference}`);
      });
    }
  }

  /**
   * Preload all guidelines (useful for offline support)
   */
  static async preloadAll(): Promise<void> {
    await Promise.allSettled(this.configs.map((config) => this.loadGuideline(config.conference)));
  }

  /**
   * Get list of available conferences with guidelines
   */
  static getAvailableConferences(): Conference[] {
    return this.configs.map((c) => c.conference);
  }

  /**
   * Check if a guideline is cached
   */
  static isCached(conference: Conference): boolean {
    return this.cache.has(conference) || this.loadFromLocalStorage(conference) !== null;
  }

  /**
   * Update guideline (for admin use or when receiving from API)
   */
  static updateGuideline(conference: Conference, content: string): void {
    this.saveToLocalStorage(conference, content);
    this.cache.set(conference, { content, timestamp: Date.now() });
  }
}
