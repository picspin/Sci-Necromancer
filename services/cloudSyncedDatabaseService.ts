import type { DatabaseService, SavedAbstract, SyncStatus } from '../types';

type NewAbstract = Omit<SavedAbstract, 'id' | 'createdAt' | 'updatedAt'>;
type CloudPayload = Pick<
  SavedAbstract,
  'title' | 'conference' | 'abstractType' | 'abstractData' | 'categories' | 'keywords' | 'rsna'
>;

interface CloudSyncBoundary {
  enabled(): boolean;
  saveCloud(
    clientId: string,
    payload: CloudPayload,
    expectedUpdatedAt: string | null
  ): Promise<unknown>;
  deleteCloud(clientId: string): Promise<unknown>;
  listCloud(): Promise<Array<Record<string, unknown>>>;
}

function cloudPayload(abstract: NewAbstract | SavedAbstract): CloudPayload {
  return {
    title: abstract.title,
    conference: abstract.conference,
    abstractType: abstract.abstractType,
    abstractData: abstract.abstractData,
    categories: abstract.categories,
    keywords: abstract.keywords,
    rsna: abstract.rsna,
  };
}

export class CloudSyncedDatabaseService implements DatabaseService {
  constructor(
    private readonly local: DatabaseService,
    private readonly cloud: CloudSyncBoundary
  ) {}

  private async pushCloud(
    clientId: string,
    payload: CloudPayload,
    expectedUpdatedAt: string | null
  ): Promise<string | undefined> {
    const result = await this.cloud.saveCloud(clientId, payload, expectedUpdatedAt);
    const updatedAt = (result as { updated_at?: unknown } | null)?.updated_at;
    return typeof updatedAt === 'string' ? updatedAt : undefined;
  }

  private async markLocal(
    clientId: string,
    syncStatus: SavedAbstract['syncStatus'],
    cloudVersion?: string
  ): Promise<void> {
    if (await this.local.loadAbstract(clientId)) {
      await this.local.updateAbstract(clientId, {
        syncStatus,
        ...(cloudVersion ? { cloudVersion } : {}),
      });
    }
  }

  private async retryPending(items: SavedAbstract[]): Promise<boolean> {
    let changedRemote = false;
    for (const item of items.filter((candidate) => candidate.syncStatus === 'local')) {
      try {
        const cloudVersion = await this.pushCloud(
          item.id,
          cloudPayload(item),
          item.cloudVersion ?? null
        );
        await this.markLocal(item.id, 'synced', cloudVersion);
        changedRemote = true;
      } catch (error) {
        if ((error as { code?: string })?.code === 'abstract_conflict') {
          await this.markLocal(item.id, 'conflict');
        }
      }
    }
    return changedRemote;
  }

  private async hydrateLocalFromRemote(
    localItem: SavedAbstract,
    remoteItem: SavedAbstract
  ): Promise<SavedAbstract> {
    await this.local.updateAbstract(localItem.id, {
      title: remoteItem.title,
      conference: remoteItem.conference,
      abstractType: remoteItem.abstractType,
      abstractData: remoteItem.abstractData,
      categories: remoteItem.categories,
      keywords: remoteItem.keywords,
      rsna: remoteItem.rsna,
      syncStatus: 'synced',
      cloudVersion: remoteItem.cloudVersion,
    });
    return (
      (await this.local.loadAbstract(localItem.id)) ?? {
        ...remoteItem,
        originalText: localItem.originalText,
        generationParameters: localItem.generationParameters,
        userId: localItem.userId,
      }
    );
  }

  private remoteIsNewer(localItem: SavedAbstract, remoteItem: SavedAbstract): boolean {
    return localItem.cloudVersion
      ? remoteItem.cloudVersion !== localItem.cloudVersion
      : remoteItem.updatedAt >= localItem.updatedAt;
  }

  async saveAbstract(abstract: NewAbstract): Promise<string> {
    const id = await this.local.saveAbstract(abstract);
    if (this.cloud.enabled()) {
      try {
        const cloudVersion = await this.pushCloud(id, cloudPayload(abstract), null);
        await this.markLocal(id, 'synced', cloudVersion);
      } catch (error) {
        await this.markLocal(id, 'local');
        console.warn('Cloud save deferred; local copy is preserved:', error);
      }
    }
    return id;
  }

  private async remoteAbstracts(): Promise<SavedAbstract[]> {
    if (!this.cloud.enabled()) return [];
    return (await this.cloud.listCloud()).flatMap((row) => {
      const payload = row.payload as Partial<SavedAbstract> | undefined;
      if (!payload?.abstractData || !payload.abstractType || !Array.isArray(payload.keywords))
        return [];
      const clientId = String(row.client_id || row.id);
      return [
        {
          id: clientId,
          title: String(row.title || ''),
          conference: row.conference as SavedAbstract['conference'],
          abstractType: payload.abstractType,
          abstractData: payload.abstractData,
          originalText: '',
          categories: payload.categories,
          keywords: payload.keywords,
          rsna: payload.rsna,
          createdAt: new Date(String(row.created_at)),
          updatedAt: new Date(String(row.updated_at)),
          syncStatus: 'synced' as const,
          cloudVersion: typeof row.updated_at === 'string' ? row.updated_at : undefined,
        },
      ];
    });
  }

  async loadAbstract(id: string) {
    const local = await this.local.loadAbstract(id);
    try {
      const remote = (await this.remoteAbstracts()).find((item) => item.id === id) ?? null;
      if (!local) return remote;
      if (!remote) return local;
      if (local.syncStatus === 'local' || local.syncStatus === 'conflict') return local;
      return this.remoteIsNewer(local, remote)
        ? await this.hydrateLocalFromRemote(local, remote)
        : local;
    } catch (error) {
      console.warn('Cloud load unavailable; using local copy:', error);
      return local;
    }
  }

  async listAbstracts(userId?: string) {
    let local = await this.local.listAbstracts(userId);
    try {
      let remote = await this.remoteAbstracts();
      if (await this.retryPending(local)) remote = await this.remoteAbstracts();
      local = await this.local.listAbstracts(userId);
      const merged = new Map(local.map((item) => [item.id, item]));
      for (const remoteItem of remote) {
        const current = merged.get(remoteItem.id);
        if (
          !current ||
          (current.syncStatus !== 'local' &&
            current.syncStatus !== 'conflict' &&
            this.remoteIsNewer(current, remoteItem))
        ) {
          merged.set(
            remoteItem.id,
            current ? await this.hydrateLocalFromRemote(current, remoteItem) : remoteItem
          );
        }
      }
      return [...merged.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.warn('Cloud list unavailable; showing local abstracts:', error);
      return local;
    }
  }

  async deleteAbstract(id: string): Promise<void> {
    if (this.cloud.enabled()) await this.cloud.deleteCloud(id);
    if (await this.local.loadAbstract(id)) await this.local.deleteAbstract(id);
  }

  async updateAbstract(id: string, updates: Partial<SavedAbstract>): Promise<void> {
    const local = await this.local.loadAbstract(id);
    if (local) await this.local.updateAbstract(id, { ...updates, syncStatus: 'local' });
    const merged = {
      ...(local ? await this.local.loadAbstract(id) : await this.loadAbstract(id)),
      ...updates,
    } as SavedAbstract;
    if (!merged.abstractData) throw new Error(`Abstract with id ${id} not found`);
    if (this.cloud.enabled()) {
      try {
        const cloudVersion = await this.pushCloud(
          id,
          cloudPayload(merged),
          merged.cloudVersion ?? null
        );
        await this.markLocal(id, 'synced', cloudVersion);
      } catch (error) {
        if (!local) throw error;
        await this.markLocal(
          id,
          (error as { code?: string })?.code === 'abstract_conflict' ? 'conflict' : 'local'
        );
        console.warn('Cloud update deferred; local copy is preserved:', error);
      }
    }
  }

  async importData(jsonData: string): Promise<void> {
    const localImporter = this.local as DatabaseService & {
      importData?(value: string): Promise<void>;
    };
    if (!localImporter.importData) throw new Error('Local import is unavailable');
    await localImporter.importData(jsonData);
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const [base, items] = await Promise.all([
      this.local.getSyncStatus?.() ??
        Promise.resolve({
          isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
          lastSync: null,
          pendingChanges: 0,
          conflictCount: 0,
        }),
      this.local.listAbstracts(),
    ]);
    return {
      ...base,
      pendingChanges: items.filter((item) => item.syncStatus === 'local').length,
      conflictCount: items.filter((item) => item.syncStatus === 'conflict').length,
    };
  }
}
