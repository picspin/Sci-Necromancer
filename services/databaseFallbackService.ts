import { DatabaseService, SavedAbstract, SyncStatus } from '../types';
import { LocalStorageService } from './databaseService';
import { notificationService } from '../lib/utils/notificationService';

export class DatabaseFallbackService implements DatabaseService {
  private localService: LocalStorageService;
  private cloudService: DatabaseService | null = null;
  private isCloudEnabled: boolean = false;

  constructor() {
    this.localService = new LocalStorageService();
  }

  setCloudService(service: DatabaseService | null, enabled: boolean) {
    this.cloudService = service;
    this.isCloudEnabled = enabled;
  }

  async saveAbstract(abstract: Omit<SavedAbstract, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Always save locally first
      const localId = await this.localService.saveAbstract(abstract);
      
      // Try to save to cloud if enabled and available
      if (this.isCloudEnabled && this.cloudService) {
        try {
          const cloudId = await this.cloudService.saveAbstract({
            ...abstract,
            syncStatus: 'synced',
          });
          
          // Update local record with cloud sync status
          await this.localService.updateAbstract(localId, { 
            syncStatus: 'synced',
            id: cloudId 
          });
          
          return cloudId;
        } catch (cloudError) {
          console.warn('Failed to save to cloud, using local storage:', cloudError);
          notificationService.warning(
            'Cloud Sync Failed',
            'Abstract saved locally. Will sync when connection is restored.'
          );
          
          // Mark as local-only
          await this.localService.updateAbstract(localId, { syncStatus: 'local' });
          return localId;
        }
      }
      
      return localId;
    } catch (error) {
      console.error('Failed to save abstract:', error);
      notificationService.error(
        'Save Failed',
        'Failed to save abstract. Please try again.'
      );
      throw error;
    }
  }

  async loadAbstract(id: string): Promise<SavedAbstract | null> {
    try {
      // Try cloud first if enabled
      if (this.isCloudEnabled && this.cloudService) {
        try {
          const cloudAbstract = await this.cloudService.loadAbstract(id);
          if (cloudAbstract) {
            return cloudAbstract;
          }
        } catch (cloudError) {
          console.warn('Failed to load from cloud, trying local:', cloudError);
        }
      }
      
      // Fallback to local storage
      return await this.localService.loadAbstract(id);
    } catch (error) {
      console.error('Failed to load abstract:', error);
      notificationService.error(
        'Load Failed',
        'Failed to load abstract. Please try again.'
      );
      throw error;
    }
  }

  async listAbstracts(userId?: string): Promise<SavedAbstract[]> {
    try {
      let abstracts: SavedAbstract[] = [];
      
      // Get cloud abstracts if enabled
      if (this.isCloudEnabled && this.cloudService) {
        try {
          const cloudAbstracts = await this.cloudService.listAbstracts(userId);
          abstracts = [...cloudAbstracts];
        } catch (cloudError) {
          console.warn('Failed to list cloud abstracts:', cloudError);
        }
      }
      
      // Get local abstracts
      const localAbstracts = await this.localService.listAbstracts(userId);
      
      // Merge and deduplicate (prefer cloud versions)
      const cloudIds = new Set(abstracts.map(a => a.id));
      const uniqueLocalAbstracts = localAbstracts.filter(a => !cloudIds.has(a.id));
      
      return [...abstracts, ...uniqueLocalAbstracts];
    } catch (error) {
      console.error('Failed to list abstracts:', error);
      // Return local abstracts as fallback
      return await this.localService.listAbstracts(userId);
    }
  }

  async deleteAbstract(id: string): Promise<void> {
    try {
      // Delete from cloud if enabled
      if (this.isCloudEnabled && this.cloudService) {
        try {
          await this.cloudService.deleteAbstract(id);
        } catch (cloudError) {
          console.warn('Failed to delete from cloud:', cloudError);
        }
      }
      
      // Delete from local storage
      await this.localService.deleteAbstract(id);
    } catch (error) {
      console.error('Failed to delete abstract:', error);
      notificationService.error(
        'Delete Failed',
        'Failed to delete abstract. Please try again.'
      );
      throw error;
    }
  }

  async updateAbstract(id: string, updates: Partial<SavedAbstract>): Promise<void> {
    try {
      // Update cloud if enabled
      if (this.isCloudEnabled && this.cloudService) {
        try {
          await this.cloudService.updateAbstract(id, {
            ...updates,
            syncStatus: 'synced',
          });
        } catch (cloudError) {
          console.warn('Failed to update cloud:', cloudError);
          updates.syncStatus = 'local';
        }
      }
      
      // Update local storage
      await this.localService.updateAbstract(id, updates);
    } catch (error) {
      console.error('Failed to update abstract:', error);
      notificationService.error(
        'Update Failed',
        'Failed to update abstract. Please try again.'
      );
      throw error;
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const localAbstracts = await this.localService.listAbstracts();
    const pendingChanges = localAbstracts.filter(a => a.syncStatus === 'local').length;
    const conflictCount = localAbstracts.filter(a => a.syncStatus === 'conflict').length;
    
    return {
      isOnline: this.isCloudEnabled && this.cloudService !== null,
      lastSync: new Date(), // TODO: Implement proper last sync tracking
      pendingChanges,
      conflictCount,
    };
  }

  // Sync local changes to cloud
  async syncToCloud(): Promise<void> {
    if (!this.isCloudEnabled || !this.cloudService) {
      return;
    }

    try {
      const localAbstracts = await this.localService.listAbstracts();
      const pendingAbstracts = localAbstracts.filter(a => a.syncStatus === 'local');
      
      for (const abstract of pendingAbstracts) {
        try {
          await this.cloudService.saveAbstract(abstract);
          await this.localService.updateAbstract(abstract.id, { syncStatus: 'synced' });
        } catch (error) {
          console.warn(`Failed to sync abstract ${abstract.id}:`, error);
        }
      }
      
      if (pendingAbstracts.length > 0) {
        notificationService.success(
          'Sync Complete',
          `Synced ${pendingAbstracts.length} abstracts to cloud`
        );
      }
    } catch (error) {
      console.error('Failed to sync to cloud:', error);
      notificationService.error(
        'Sync Failed',
        'Failed to sync abstracts to cloud. Will retry later.'
      );
    }
  }
}

export const databaseFallbackService = new DatabaseFallbackService();