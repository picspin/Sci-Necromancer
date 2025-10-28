import { SavedAbstract, DatabaseService, SyncStatus, ConflictResolution } from '../types';

export class LocalStorageService implements DatabaseService {
    private readonly STORAGE_KEY = 'sci-necromancer-abstracts';
    private readonly METADATA_KEY = 'sci-necromancer-metadata';
    private readonly VERSION_KEY = 'sci-necromancer-version';
    private readonly CURRENT_VERSION = '1.0.0';

    constructor() {
        this.initializeStorage();
    }

    private initializeStorage(): void {
        // Check if migration is needed
        const currentVersion = localStorage.getItem(this.VERSION_KEY);
        if (!currentVersion || currentVersion !== this.CURRENT_VERSION) {
            this.migrateData(currentVersion);
            localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
        }
    }

    private migrateData(fromVersion: string | null): void {
        // Handle data migration for future versions
        if (!fromVersion) {
            // First time setup
            const initialData: SavedAbstract[] = [];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));

            const initialMetadata = {
                lastSync: null,
                totalAbstracts: 0,
                lastBackup: null
            };
            localStorage.setItem(this.METADATA_KEY, JSON.stringify(initialMetadata));
        }
        // Add future migration logic here
    }

    private getStoredAbstracts(): SavedAbstract[] {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return [];

            const abstracts = JSON.parse(stored);
            // Convert date strings back to Date objects
            return abstracts.map((abstract: any) => ({
                ...abstract,
                createdAt: new Date(abstract.createdAt),
                updatedAt: new Date(abstract.updatedAt)
            }));
        } catch (error) {
            console.error('Error reading stored abstracts:', error);
            return [];
        }
    }

    private saveStoredAbstracts(abstracts: SavedAbstract[]): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(abstracts));
            this.updateMetadata({ totalAbstracts: abstracts.length });
        } catch (error) {
            console.error('Error saving abstracts to localStorage:', error);
            throw new Error('Failed to save abstract to local storage');
        }
    }

    private updateMetadata(updates: Partial<any>): void {
        try {
            const current = JSON.parse(localStorage.getItem(this.METADATA_KEY) || '{}');
            const updated = { ...current, ...updates };
            localStorage.setItem(this.METADATA_KEY, JSON.stringify(updated));
        } catch (error) {
            console.error('Error updating metadata:', error);
        }
    }

    private generateId(): string {
        return `abstract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private validateAbstract(abstract: Partial<SavedAbstract>): boolean {
        return !!(
            abstract.title &&
            abstract.conference &&
            abstract.abstractType &&
            abstract.abstractData &&
            abstract.originalText
        );
    }

    async saveAbstract(abstract: Omit<SavedAbstract, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        if (!this.validateAbstract(abstract)) {
            throw new Error('Invalid abstract data: missing required fields');
        }

        const abstracts = this.getStoredAbstracts();
        const now = new Date();
        const id = this.generateId();

        const newAbstract: SavedAbstract = {
            ...abstract,
            id,
            createdAt: now,
            updatedAt: now
        };

        abstracts.push(newAbstract);
        this.saveStoredAbstracts(abstracts);

        return id;
    }

    async loadAbstract(id: string): Promise<SavedAbstract | null> {
        const abstracts = this.getStoredAbstracts();
        const found = abstracts.find(abstract => abstract.id === id);
        return found || null;
    }

    async listAbstracts(userId?: string): Promise<SavedAbstract[]> {
        const abstracts = this.getStoredAbstracts();

        if (userId) {
            return abstracts.filter(abstract => abstract.userId === userId);
        }

        // Sort by updatedAt descending (most recent first)
        return abstracts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async deleteAbstract(id: string): Promise<void> {
        const abstracts = this.getStoredAbstracts();
        const filteredAbstracts = abstracts.filter(abstract => abstract.id !== id);

        if (filteredAbstracts.length === abstracts.length) {
            throw new Error(`Abstract with id ${id} not found`);
        }

        this.saveStoredAbstracts(filteredAbstracts);
    }

    async updateAbstract(id: string, updates: Partial<SavedAbstract>): Promise<void> {
        const abstracts = this.getStoredAbstracts();
        const index = abstracts.findIndex(abstract => abstract.id === id);

        if (index === -1) {
            throw new Error(`Abstract with id ${id} not found`);
        }

        abstracts[index] = {
            ...abstracts[index],
            ...updates,
            updatedAt: new Date()
        };

        this.saveStoredAbstracts(abstracts);
    }

    // Additional utility methods
    async searchAbstracts(query: string): Promise<SavedAbstract[]> {
        const abstracts = this.getStoredAbstracts();
        const lowercaseQuery = query.toLowerCase();

        return abstracts.filter(abstract =>
            abstract.title.toLowerCase().includes(lowercaseQuery) ||
            abstract.abstractData.impact.toLowerCase().includes(lowercaseQuery) ||
            abstract.abstractData.synopsis.toLowerCase().includes(lowercaseQuery) ||
            abstract.keywords.some(keyword => keyword.toLowerCase().includes(lowercaseQuery))
        );
    }

    async getStorageInfo(): Promise<{ used: number; available: number; total: number }> {
        const used = new Blob([localStorage.getItem(this.STORAGE_KEY) || '']).size;
        const available = 5 * 1024 * 1024 - used; // Assume 5MB localStorage limit
        return {
            used,
            available: Math.max(0, available),
            total: 5 * 1024 * 1024
        };
    }

    async exportData(): Promise<string> {
        const abstracts = this.getStoredAbstracts();
        const metadata = JSON.parse(localStorage.getItem(this.METADATA_KEY) || '{}');

        return JSON.stringify({
            version: this.CURRENT_VERSION,
            exportDate: new Date().toISOString(),
            abstracts,
            metadata
        }, null, 2);
    }

    async importData(jsonData: string): Promise<void> {
        try {
            const data = JSON.parse(jsonData);

            if (!data.abstracts || !Array.isArray(data.abstracts)) {
                throw new Error('Invalid import data format');
            }

            // Validate each abstract
            const validAbstracts = data.abstracts.filter((abstract: any) =>
                this.validateAbstract(abstract)
            );

            if (validAbstracts.length === 0) {
                throw new Error('No valid abstracts found in import data');
            }

            // Convert date strings to Date objects
            const processedAbstracts = validAbstracts.map((abstract: any) => ({
                ...abstract,
                createdAt: new Date(abstract.createdAt),
                updatedAt: new Date(abstract.updatedAt)
            }));

            this.saveStoredAbstracts(processedAbstracts);
        } catch (error) {
            throw new Error(`Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseService implements DatabaseService {
    private supabase: SupabaseClient;
    private localService: LocalStorageService;
    private isOnline: boolean = navigator.onLine;

    constructor(supabaseUrl: string, supabaseKey: string) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.localService = new LocalStorageService();

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncPendingChanges();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    private async getCurrentUser() {
        const { data: { user } } = await this.supabase.auth.getUser();
        return user;
    }



    async saveAbstract(abstract: Omit<SavedAbstract, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        // Always save locally first
        const localId = await this.localService.saveAbstract(abstract);

        if (this.isOnline) {
            try {
                const user = await this.getCurrentUser();
                const now = new Date().toISOString();

                const { data, error } = await this.supabase
                    .from('abstracts')
                    .insert({
                        local_id: localId,
                        title: abstract.title,
                        conference: abstract.conference,
                        abstract_type: abstract.abstractType,
                        abstract_data: abstract.abstractData,
                        original_text: abstract.originalText,
                        categories: abstract.categories,
                        keywords: abstract.keywords,
                        user_id: user?.id,
                        created_at: now,
                        updated_at: now
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('Failed to sync to cloud:', error);
                    // Mark for later sync
                    this.markForSync(localId);
                } else {
                    // Update local record with cloud ID
                    await this.localService.updateAbstract(localId, {
                        id: data.id,
                        userId: user?.id
                    });
                }
            } catch (error) {
                console.error('Cloud sync error:', error);
                this.markForSync(localId);
            }
        } else {
            this.markForSync(localId);
        }

        return localId;
    }

    async loadAbstract(id: string): Promise<SavedAbstract | null> {
        // Try local first
        const localAbstract = await this.localService.loadAbstract(id);

        if (!this.isOnline || localAbstract) {
            return localAbstract;
        }

        try {
            const user = await this.getCurrentUser();
            if (!user) return localAbstract;

            const { data, error } = await this.supabase
                .from('abstracts')
                .select('*')
                .eq('id', id)
                .eq('user_id', user.id)
                .single();

            if (error || !data) {
                return localAbstract;
            }

            const cloudAbstract: SavedAbstract = {
                id: data.id,
                title: data.title,
                conference: data.conference,
                abstractType: data.abstract_type,
                abstractData: data.abstract_data,
                originalText: data.original_text,
                categories: data.categories || [],
                keywords: data.keywords || [],
                createdAt: new Date(data.created_at),
                updatedAt: new Date(data.updated_at),
                userId: data.user_id
            };

            // Cache locally
            if (!localAbstract) {
                await this.localService.saveAbstract({
                    title: cloudAbstract.title,
                    conference: cloudAbstract.conference,
                    abstractType: cloudAbstract.abstractType,
                    abstractData: cloudAbstract.abstractData,
                    originalText: cloudAbstract.originalText,
                    categories: cloudAbstract.categories,
                    keywords: cloudAbstract.keywords,
                    userId: cloudAbstract.userId
                });
            }

            return cloudAbstract;
        } catch (error) {
            console.error('Failed to load from cloud:', error);
            return localAbstract;
        }
    }

    async listAbstracts(userId?: string): Promise<SavedAbstract[]> {
        const localAbstracts = await this.localService.listAbstracts(userId);

        if (!this.isOnline) {
            return localAbstracts;
        }

        try {
            const user = await this.getCurrentUser();
            if (!user) return localAbstracts;

            const { data, error } = await this.supabase
                .from('abstracts')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Failed to fetch from cloud:', error);
                return localAbstracts;
            }

            const cloudAbstracts: SavedAbstract[] = data.map(item => ({
                id: item.id,
                title: item.title,
                conference: item.conference,
                abstractType: item.abstract_type,
                abstractData: item.abstract_data,
                originalText: item.original_text,
                categories: item.categories || [],
                keywords: item.keywords || [],
                createdAt: new Date(item.created_at),
                updatedAt: new Date(item.updated_at),
                userId: item.user_id
            }));

            // Merge with local abstracts, preferring cloud versions
            const merged = this.mergeAbstractLists(localAbstracts, cloudAbstracts);

            // Update local cache
            for (const abstract of cloudAbstracts) {
                const localExists = localAbstracts.find(local => local.id === abstract.id);
                if (!localExists) {
                    await this.localService.saveAbstract({
                        title: abstract.title,
                        conference: abstract.conference,
                        abstractType: abstract.abstractType,
                        abstractData: abstract.abstractData,
                        originalText: abstract.originalText,
                        categories: abstract.categories,
                        keywords: abstract.keywords,
                        userId: abstract.userId
                    });
                }
            }

            return merged;
        } catch (error) {
            console.error('Failed to sync with cloud:', error);
            return localAbstracts;
        }
    }

    async deleteAbstract(id: string): Promise<void> {
        // Delete locally first
        await this.localService.deleteAbstract(id);

        if (this.isOnline) {
            try {
                const user = await this.getCurrentUser();
                if (user) {
                    const { error } = await this.supabase
                        .from('abstracts')
                        .delete()
                        .eq('id', id)
                        .eq('user_id', user.id);

                    if (error) {
                        console.error('Failed to delete from cloud:', error);
                    }
                }
            } catch (error) {
                console.error('Cloud delete error:', error);
            }
        }
    }

    async updateAbstract(id: string, updates: Partial<SavedAbstract>): Promise<void> {
        // Update locally first
        await this.localService.updateAbstract(id, updates);

        if (this.isOnline) {
            try {
                const user = await this.getCurrentUser();
                if (user) {
                    const cloudUpdates: any = {
                        updated_at: new Date().toISOString()
                    };

                    if (updates.title) cloudUpdates.title = updates.title;
                    if (updates.conference) cloudUpdates.conference = updates.conference;
                    if (updates.abstractType) cloudUpdates.abstract_type = updates.abstractType;
                    if (updates.abstractData) cloudUpdates.abstract_data = updates.abstractData;
                    if (updates.originalText) cloudUpdates.original_text = updates.originalText;
                    if (updates.categories) cloudUpdates.categories = updates.categories;
                    if (updates.keywords) cloudUpdates.keywords = updates.keywords;

                    const { error } = await this.supabase
                        .from('abstracts')
                        .update(cloudUpdates)
                        .eq('id', id)
                        .eq('user_id', user.id);

                    if (error) {
                        console.error('Failed to update in cloud:', error);
                        this.markForSync(id);
                    }
                }
            } catch (error) {
                console.error('Cloud update error:', error);
                this.markForSync(id);
            }
        } else {
            this.markForSync(id);
        }
    }

    // Authentication methods
    async signIn(email: string, password: string): Promise<void> {
        const { error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw new Error(`Sign in failed: ${error.message}`);
        }

        // Trigger sync after successful sign in
        await this.syncPendingChanges();
    }

    async signUp(email: string, password: string): Promise<void> {
        const { error } = await this.supabase.auth.signUp({
            email,
            password
        });

        if (error) {
            throw new Error(`Sign up failed: ${error.message}`);
        }
    }

    async signOut(): Promise<void> {
        const { error } = await this.supabase.auth.signOut();
        if (error) {
            throw new Error(`Sign out failed: ${error.message}`);
        }
    }

    // Sync and conflict resolution methods
    private mergeAbstractLists(local: SavedAbstract[], cloud: SavedAbstract[]): SavedAbstract[] {
        const merged = new Map<string, SavedAbstract>();

        // Add all local abstracts
        local.forEach(abstract => merged.set(abstract.id, abstract));

        // Add cloud abstracts, preferring newer versions
        cloud.forEach(cloudAbstract => {
            const localAbstract = merged.get(cloudAbstract.id);
            if (!localAbstract || cloudAbstract.updatedAt > localAbstract.updatedAt) {
                merged.set(cloudAbstract.id, cloudAbstract);
            }
        });

        return Array.from(merged.values()).sort((a, b) =>
            b.updatedAt.getTime() - a.updatedAt.getTime()
        );
    }

    private markForSync(abstractId: string): void {
        const pending = JSON.parse(localStorage.getItem('pending-sync') || '[]');
        if (!pending.includes(abstractId)) {
            pending.push(abstractId);
            localStorage.setItem('pending-sync', JSON.stringify(pending));
        }
    }

    private async syncPendingChanges(): Promise<void> {
        if (!this.isOnline) return;

        const pending = JSON.parse(localStorage.getItem('pending-sync') || '[]');
        const synced: string[] = [];

        for (const abstractId of pending) {
            try {
                const localAbstract = await this.localService.loadAbstract(abstractId);
                if (localAbstract) {
                    // Try to sync to cloud
                    await this.saveAbstract({
                        title: localAbstract.title,
                        conference: localAbstract.conference,
                        abstractType: localAbstract.abstractType,
                        abstractData: localAbstract.abstractData,
                        originalText: localAbstract.originalText,
                        categories: localAbstract.categories,
                        keywords: localAbstract.keywords,
                        userId: localAbstract.userId
                    });
                    synced.push(abstractId);
                }
            } catch (error) {
                console.error(`Failed to sync abstract ${abstractId}:`, error);
            }
        }

        // Remove successfully synced items
        const remaining = pending.filter((id: string) => !synced.includes(id));
        localStorage.setItem('pending-sync', JSON.stringify(remaining));
    }

    async getSyncStatus(): Promise<SyncStatus> {
        const pending = JSON.parse(localStorage.getItem('pending-sync') || '[]');
        const lastSyncStr = localStorage.getItem('last-sync');

        return {
            isOnline: this.isOnline,
            lastSync: lastSyncStr ? new Date(lastSyncStr) : null,
            pendingChanges: pending.length,
            conflictCount: 0 // TODO: Implement conflict detection
        };
    }

    async resolveConflicts(resolutions: ConflictResolution[]): Promise<void> {
        for (const resolution of resolutions) {
            try {
                if (resolution.resolution === 'local') {
                    // Keep local version, update cloud
                    await this.updateAbstract(resolution.abstractId, resolution.localVersion);
                } else if (resolution.resolution === 'remote') {
                    // Keep remote version, update local
                    await this.localService.updateAbstract(resolution.abstractId, resolution.remoteVersion);
                } else if (resolution.resolution === 'merge') {
                    // Implement merge logic based on specific fields
                    const merged = this.mergeAbstracts(resolution.localVersion, resolution.remoteVersion);
                    await this.updateAbstract(resolution.abstractId, merged);
                }
            } catch (error) {
                console.error(`Failed to resolve conflict for ${resolution.abstractId}:`, error);
            }
        }
    }

    private mergeAbstracts(local: Partial<SavedAbstract>, remote: Partial<SavedAbstract>): Partial<SavedAbstract> {
        // Simple merge strategy: prefer newer fields
        const localUpdated = local.updatedAt || new Date(0);
        const remoteUpdated = remote.updatedAt || new Date(0);
        
        return {
            ...local,
            title: localUpdated > remoteUpdated ? local.title : remote.title,
            abstractData: localUpdated > remoteUpdated ? local.abstractData : remote.abstractData,
            categories: localUpdated > remoteUpdated ? local.categories : remote.categories,
            keywords: localUpdated > remoteUpdated ? local.keywords : remote.keywords,
            updatedAt: new Date()
        };
    }
}

// Unified database service that handles both local and cloud storage
export class UnifiedDatabaseService implements DatabaseService {
    private localService: LocalStorageService;
    private cloudService: SupabaseService | null = null;
    private useCloud: boolean = false;

    constructor(supabaseConfig?: { url: string; key: string }) {
        this.localService = new LocalStorageService();

        if (supabaseConfig) {
            this.cloudService = new SupabaseService(supabaseConfig.url, supabaseConfig.key);
            this.useCloud = true;
        }
    }

    async saveAbstract(abstract: Omit<SavedAbstract, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        if (this.useCloud && this.cloudService) {
            return await this.cloudService.saveAbstract(abstract);
        }
        return await this.localService.saveAbstract(abstract);
    }

    async loadAbstract(id: string): Promise<SavedAbstract | null> {
        if (this.useCloud && this.cloudService) {
            return await this.cloudService.loadAbstract(id);
        }
        return await this.localService.loadAbstract(id);
    }

    async listAbstracts(userId?: string): Promise<SavedAbstract[]> {
        if (this.useCloud && this.cloudService) {
            return await this.cloudService.listAbstracts(userId);
        }
        return await this.localService.listAbstracts(userId);
    }

    async deleteAbstract(id: string): Promise<void> {
        if (this.useCloud && this.cloudService) {
            return await this.cloudService.deleteAbstract(id);
        }
        return await this.localService.deleteAbstract(id);
    }

    async updateAbstract(id: string, updates: Partial<SavedAbstract>): Promise<void> {
        if (this.useCloud && this.cloudService) {
            return await this.cloudService.updateAbstract(id, updates);
        }
        return await this.localService.updateAbstract(id, updates);
    }

    // Cloud-specific methods
    async signIn(email: string, password: string): Promise<void> {
        if (this.cloudService) {
            await this.cloudService.signIn(email, password);
        }
    }

    async signUp(email: string, password: string): Promise<void> {
        if (this.cloudService) {
            await this.cloudService.signUp(email, password);
        }
    }

    async signOut(): Promise<void> {
        if (this.cloudService) {
            await this.cloudService.signOut();
        }
    }

    async getSyncStatus(): Promise<SyncStatus | null> {
        if (this.cloudService) {
            return await this.cloudService.getSyncStatus();
        }
        return null;
    }

    // Local-specific methods
    async searchAbstracts(query: string): Promise<SavedAbstract[]> {
        return await this.localService.searchAbstracts(query);
    }

    async exportData(): Promise<string> {
        return await this.localService.exportData();
    }

    async importData(jsonData: string): Promise<void> {
        return await this.localService.importData(jsonData);
    }

    getLocalService(): LocalStorageService {
        return this.localService;
    }

    getCloudService(): SupabaseService | null {
        return this.cloudService;
    }
}