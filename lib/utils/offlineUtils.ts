import { AbstractData, AnalysisResult, Category } from '../../types';

export interface OfflineCapabilities {
  textProcessing: boolean;
  basicAnalysis: boolean;
  fileProcessing: boolean;
  dataStorage: boolean;
}

export class OfflineService {
  private isOnline: boolean = navigator.onLine;
  private offlineNotificationShown: boolean = false;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.offlineNotificationShown = false;
    console.log('Connection restored - online mode enabled');
    
    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('connectionRestored'));
  }

  private handleOffline(): void {
    this.isOnline = false;
    console.log('Connection lost - entering offline mode');
    
    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('connectionLost'));
    
    if (!this.offlineNotificationShown) {
      this.showOfflineNotification();
      this.offlineNotificationShown = true;
    }
  }

  private showOfflineNotification(): void {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded shadow-lg z-50';
    notification.innerHTML = `
      <div class="flex items-center">
        <span class="mr-2">📡</span>
        <span>Working offline - limited functionality available</span>
        <button class="ml-2 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  isOffline(): boolean {
    return !this.isOnline;
  }

  getCapabilities(): OfflineCapabilities {
    return {
      textProcessing: true, // Basic text manipulation works offline
      basicAnalysis: true, // Simple keyword extraction works offline
      fileProcessing: true, // File reading works offline
      dataStorage: true // localStorage works offline
    };
  }

  // Offline fallback for content analysis
  analyzeContentOffline(text: string): AnalysisResult {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Simple frequency analysis
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Extract top keywords
    const keywords = Array.from(wordCount.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    // Basic category detection based on common medical terms
    const categories: Category[] = [];
    const medicalTerms = {
      'imaging': ['mri', 'scan', 'image', 'imaging', 'contrast', 'signal'],
      'clinical': ['patient', 'clinical', 'diagnosis', 'treatment', 'therapy'],
      'research': ['study', 'analysis', 'research', 'method', 'results'],
      'technical': ['sequence', 'protocol', 'parameter', 'acquisition']
    };

    Object.entries(medicalTerms).forEach(([category, terms]) => {
      const matches = terms.filter(term => 
        keywords.some(keyword => keyword.includes(term))
      ).length;
      
      if (matches > 0) {
        categories.push({
          name: category,
          type: 'main',
          probability: Math.min(matches / terms.length, 1)
        });
      }
    });

    return { categories, keywords };
  }

  // Offline fallback for abstract generation
  generateBasicAbstractOffline(text: string): AbstractData {
    const sentences = text.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    // Extract impact (first meaningful sentences)
    const impact = sentences.slice(0, 2).join('. ').trim() + '.';
    
    // Extract synopsis (middle sentences)
    const synopsis = sentences.slice(2, 5).join('. ').trim() + '.';
    
    // Basic keyword extraction
    const analysis = this.analyzeContentOffline(text);

    return {
      impact: impact || 'Impact statement generated offline with limited functionality.',
      synopsis: synopsis || 'Synopsis generated offline with limited functionality.',
      keywords: analysis.keywords.slice(0, 5)
    };
  }

  // Check if a feature is available offline
  isFeatureAvailable(feature: keyof OfflineCapabilities): boolean {
    return this.getCapabilities()[feature];
  }

  // Get offline-appropriate error message
  getOfflineMessage(feature: string): string {
    return `${feature} requires an internet connection. Please check your connection and try again, or use the limited offline functionality.`;
  }

  // Sync data when connection is restored
  async syncWhenOnline(syncFunction: () => Promise<void>): Promise<void> {
    if (this.isOnline) {
      try {
        await syncFunction();
      } catch (error) {
        console.error('Sync failed:', error);
      }
    } else {
      // Queue for later sync
      const handleOnline = async () => {
        try {
          await syncFunction();
          window.removeEventListener('online', handleOnline);
        } catch (error) {
          console.error('Deferred sync failed:', error);
        }
      };
      window.addEventListener('online', handleOnline);
    }
  }
}

// Export singleton instance
export const offlineService = new OfflineService();