import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService, SavedAbstract } from '../types';
import { CloudSyncedDatabaseService } from './cloudSyncedDatabaseService';

const record = {
  title: 'Test',
  conference: 'RSNA',
  abstractType: 'RSNA Science Abstract',
  abstractData: {
    abstract: 'Generated abstract',
    impact: 'Impact',
    synopsis: 'Synopsis',
    keywords: [],
  },
  originalText: 'private source manuscript',
  keywords: [],
} as const;

describe('CloudSyncedDatabaseService', () => {
  it('syncs only an explicit save and excludes the source manuscript', async () => {
    const local = {
      saveAbstract: vi.fn().mockResolvedValue('local-1'),
      loadAbstract: vi.fn().mockResolvedValue(null),
    } as unknown as DatabaseService;
    const saveCloud = vi.fn().mockResolvedValue(undefined);
    const service = new CloudSyncedDatabaseService(local, {
      enabled: () => true,
      saveCloud,
      deleteCloud: vi.fn(),
      listCloud: vi.fn().mockResolvedValue([]),
    });

    await service.saveAbstract(record as never);

    expect(saveCloud).toHaveBeenCalledWith(
      'local-1',
      expect.not.objectContaining({ originalText: expect.anything() }),
      null
    );
  });

  it('keeps local saving available when cloud sync is disabled', async () => {
    const local = {
      saveAbstract: vi.fn().mockResolvedValue('local-1'),
    } as unknown as DatabaseService;
    const saveCloud = vi.fn();
    const service = new CloudSyncedDatabaseService(local, {
      enabled: () => false,
      saveCloud,
      deleteCloud: vi.fn(),
      listCloud: vi.fn().mockResolvedValue([]),
    });

    expect(await service.saveAbstract(record as never)).toBe('local-1');
    expect(saveCloud).not.toHaveBeenCalled();
  });

  it('merges member cloud records for cross-device recovery', async () => {
    const local = { listAbstracts: vi.fn().mockResolvedValue([]) } as unknown as DatabaseService;
    const service = new CloudSyncedDatabaseService(local, {
      enabled: () => true,
      saveCloud: vi.fn(),
      deleteCloud: vi.fn(),
      listCloud: vi.fn().mockResolvedValue([
        {
          id: 'remote-id',
          client_id: 'client-1',
          title: 'Cloud abstract',
          conference: 'RSNA',
          created_at: '2026-07-28T00:00:00Z',
          updated_at: '2026-07-28T00:00:00Z',
          payload: {
            abstractType: 'RSNA Science Abstract',
            abstractData: { abstract: 'Recovered', impact: '', synopsis: '', keywords: [] },
            keywords: [],
          },
        },
      ]),
    });

    await expect(service.listAbstracts()).resolves.toEqual([
      expect.objectContaining({ id: 'client-1', title: 'Cloud abstract', syncStatus: 'synced' }),
    ]);
  });

  it('marks a failed explicit cloud save as pending and retries it on the next list', async () => {
    let stored: SavedAbstract | null = null;
    const local = {
      saveAbstract: vi.fn().mockImplementation(async (value) => {
        stored = {
          ...value,
          id: 'local-1',
          createdAt: new Date('2026-07-28T00:00:00Z'),
          updatedAt: new Date('2026-07-28T00:00:00Z'),
        };
        return 'local-1';
      }),
      loadAbstract: vi.fn().mockImplementation(async () => stored),
      updateAbstract: vi.fn().mockImplementation(async (_id, updates) => {
        stored = { ...stored!, ...updates, updatedAt: new Date() };
      }),
      listAbstracts: vi.fn().mockImplementation(async () => (stored ? [stored] : [])),
      getSyncStatus: vi.fn().mockResolvedValue({
        isOnline: true,
        lastSync: null,
        pendingChanges: 0,
        conflictCount: 0,
      }),
    } as unknown as DatabaseService;
    const saveCloud = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ updated_at: '2026-07-28T01:00:00Z' });
    const service = new CloudSyncedDatabaseService(local, {
      enabled: () => true,
      saveCloud,
      deleteCloud: vi.fn(),
      listCloud: vi.fn().mockResolvedValue([]),
    });

    await service.saveAbstract(record as never);
    await expect(service.getSyncStatus()).resolves.toMatchObject({ pendingChanges: 1 });
    await service.listAbstracts();
    await expect(service.getSyncStatus()).resolves.toMatchObject({ pendingChanges: 0 });
    expect(saveCloud).toHaveBeenLastCalledWith('local-1', expect.any(Object), null);
  });

  it('keeps the original cloud version when retrying a pending edit', async () => {
    let stored = {
      ...record,
      id: 'local-1',
      createdAt: new Date('2026-07-28T00:00:00Z'),
      updatedAt: new Date('2026-07-28T00:30:00Z'),
      syncStatus: 'local' as const,
      cloudVersion: '2026-07-28T00:00:00Z',
    } as unknown as SavedAbstract;
    const local = {
      loadAbstract: vi.fn().mockImplementation(async () => stored),
      updateAbstract: vi.fn().mockImplementation(async (_id, updates) => {
        stored = { ...stored, ...updates, updatedAt: new Date() };
      }),
      listAbstracts: vi.fn().mockImplementation(async () => [stored]),
    } as unknown as DatabaseService;
    const conflict = Object.assign(new Error('abstract_conflict'), { code: 'abstract_conflict' });
    const saveCloud = vi.fn().mockRejectedValue(conflict);
    const service = new CloudSyncedDatabaseService(local, {
      enabled: () => true,
      saveCloud,
      deleteCloud: vi.fn(),
      listCloud: vi.fn().mockResolvedValue([
        {
          client_id: 'local-1',
          title: 'Newer remote',
          conference: 'RSNA',
          created_at: '2026-07-28T00:00:00Z',
          updated_at: '2026-07-28T01:00:00Z',
          payload: {
            abstractType: 'RSNA Science Abstract',
            abstractData: { abstract: 'V2', impact: '', synopsis: '', keywords: [] },
            keywords: [],
          },
        },
      ]),
    });

    await service.listAbstracts();

    expect(saveCloud).toHaveBeenCalledWith('local-1', expect.any(Object), '2026-07-28T00:00:00Z');
    expect(stored.syncStatus).toBe('conflict');
  });

  it('hydrates a newer remote version before the next local edit', async () => {
    let stored = {
      ...record,
      id: 'local-1',
      createdAt: new Date('2026-07-28T00:00:00Z'),
      updatedAt: new Date('2026-07-28T00:00:00Z'),
      syncStatus: 'synced' as const,
      cloudVersion: '2026-07-28T00:00:00Z',
    } as unknown as SavedAbstract;
    const local = {
      loadAbstract: vi.fn().mockImplementation(async () => stored),
      updateAbstract: vi.fn().mockImplementation(async (_id, updates) => {
        stored = { ...stored, ...updates, updatedAt: new Date() };
      }),
      listAbstracts: vi.fn().mockImplementation(async () => [stored]),
    } as unknown as DatabaseService;
    const service = new CloudSyncedDatabaseService(local, {
      enabled: () => true,
      saveCloud: vi.fn(),
      deleteCloud: vi.fn(),
      listCloud: vi.fn().mockResolvedValue([
        {
          client_id: 'local-1',
          title: 'Remote V2',
          conference: 'RSNA',
          created_at: '2026-07-28T00:00:00Z',
          updated_at: '2026-07-28T01:00:00Z',
          payload: {
            abstractType: 'RSNA Science Abstract',
            abstractData: { abstract: 'V2', impact: '', synopsis: '', keywords: [] },
            keywords: [],
          },
        },
      ]),
    });

    await service.listAbstracts();

    expect(stored).toMatchObject({
      title: 'Remote V2',
      cloudVersion: '2026-07-28T01:00:00Z',
      syncStatus: 'synced',
      originalText: 'private source manuscript',
    });
  });
});
