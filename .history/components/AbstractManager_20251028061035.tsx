import React, { useState, useEffect, useContext } from 'react';
import { SavedAbstract, SyncStatus } from '../types';
import { LocalStorageService } from '../services/databaseService';
import { SettingsContext } from '../context/SettingsContext';
import { useAbstractContext } from '../context/AbstractContext';

interface AbstractManagerProps {
    isVisible: boolean;
    onClose: () => void;
}

export const AbstractManager: React.FC<AbstractManagerProps> = ({ isVisible, onClose }) => {
    const { databaseService } = useContext(SettingsContext);
    const { loadAbstract: loadAbstractToContext } = useAbstractContext();
    const [abstracts, setAbstracts] = useState<SavedAbstract[]>([]);
    const [filteredAbstracts, setFilteredAbstracts] = useState<SavedAbstract[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedConference, setSelectedConference] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'date' | 'title' | 'conference'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        if (isVisible) {
            loadAbstracts();
            loadSyncStatus();
        }
    }, [isVisible]);

    useEffect(() => {
        filterAndSortAbstracts();
    }, [abstracts, searchQuery, selectedConference, selectedType, sortBy, sortOrder]);

    const loadAbstracts = async () => {
        setLoading(true);
        setError(null);
        try {
            const loadedAbstracts = await databaseService.listAbstracts();
            setAbstracts(loadedAbstracts);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load abstracts');
        } finally {
            setLoading(false);
        }
    };

    const loadSyncStatus = async () => {
        try {
            // Check if getSyncStatus method exists (optional method)
            if (databaseService.getSyncStatus && typeof databaseService.getSyncStatus === 'function') {
                const status = await databaseService.getSyncStatus();
                setSyncStatus(status);
            } else {
                // Default sync status for local-only mode
                setSyncStatus({
                    isOnline: false,
                    lastSync: null,
                    pendingChanges: 0,
                    conflictCount: 0
                });
            }
        } catch (err) {
            console.error('Failed to load sync status:', err);
            // Set default status on error
            setSyncStatus({
                isOnline: false,
                lastSync: null,
                pendingChanges: 0,
                conflictCount: 0
            });
        }
    };

    const filterAndSortAbstracts = () => {
        let filtered = [...abstracts];

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(abstract =>
                abstract.title.toLowerCase().includes(query) ||
                abstract.abstractData.impact.toLowerCase().includes(query) ||
                abstract.abstractData.synopsis.toLowerCase().includes(query) ||
                abstract.keywords.some(keyword => keyword.toLowerCase().includes(query))
            );
        }

        // Apply conference filter
        if (selectedConference !== 'all') {
            filtered = filtered.filter(abstract => abstract.conference === selectedConference);
        }

        // Apply type filter
        if (selectedType !== 'all') {
            filtered = filtered.filter(abstract => abstract.abstractType === selectedType);
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'date':
                    comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
                    break;
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'conference':
                    comparison = a.conference.localeCompare(b.conference);
                    break;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        setFilteredAbstracts(filtered);
    };

    const handleDeleteAbstract = async (id: string) => {
        try {
            await databaseService.deleteAbstract(id);
            setAbstracts(prev => prev.filter(abstract => abstract.id !== id));
            setShowDeleteConfirm(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete abstract');
        }
    };

    const handleLoadAbstract = (abstract: SavedAbstract) => {
        loadAbstractToContext(abstract);
        onClose();
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const getConferenceColor = (conference: string) => {
        switch (conference) {
            case 'ISMRM': return '#4CAF50';
            case 'RSNA': return '#2196F3';
            case 'JACC': return '#FF9800';
            default: return '#9E9E9E';
        }
    };

    const exportAbstracts = async () => {
        try {
            // Check if exportData method exists (LocalStorageService or UnifiedDatabaseService)
            if ('exportData' in databaseService && typeof databaseService.exportData === 'function') {
                const exportData = await databaseService.exportData();
                const blob = new Blob([exportData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sci-necromancer-abstracts-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                // Fallback: export abstracts manually
                const abstracts = await databaseService.listAbstracts();
                const exportData = JSON.stringify({
                    version: '1.0.0',
                    exportDate: new Date().toISOString(),
                    abstracts,
                    metadata: {}
                }, null, 2);
                const blob = new Blob([exportData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sci-necromancer-abstracts-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export abstracts');
        }
    };

    const importAbstracts = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            
            // Check if importData method exists (LocalStorageService or UnifiedDatabaseService)
            if ('importData' in databaseService && typeof databaseService.importData === 'function') {
                await databaseService.importData(text);
            } else {
                // Fallback: import abstracts manually
                const data = JSON.parse(text);
                if (!data.abstracts || !Array.isArray(data.abstracts)) {
                    throw new Error('Invalid import data format');
                }
                
                // Import each abstract
                for (const abstract of data.abstracts) {
                    try {
                        await databaseService.saveAbstract({
                            title: abstract.title,
                            conference: abstract.conference,
                            abstractType: abstract.abstractType,
                            abstractData: abstract.abstractData,
                            originalText: abstract.originalText,
                            categories: abstract.categories,
                            keywords: abstract.keywords,
                            generationParameters: abstract.generationParameters,
                            userId: abstract.userId,
                            syncStatus: abstract.syncStatus
                        });
                    } catch (err) {
                        console.error('Failed to import abstract:', abstract.title, err);
                    }
                }
            }
            
            await loadAbstracts();
            // Reset the file input
            event.target.value = '';
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import abstracts');
        }
    };

    if (!isVisible) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="abstract-manager-title"
            onClick={(e) => {
                // Close on backdrop click
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 id="abstract-manager-title" className="text-2xl font-bold text-gray-900">Abstract Manager</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {abstracts.length} abstracts saved
                            {syncStatus && (
                                <span className="ml-2">
                                    • {syncStatus.isOnline ? '🟢 Online' : '🔴 Offline'}
                                    {syncStatus.pendingChanges > 0 && (
                                        <span className="text-orange-600">
                                            {' '}• {syncStatus.pendingChanges} pending sync
                                        </span>
                                    )}
                                    {syncStatus.conflictCount > 0 && (
                                        <span className="text-red-600">
                                            {' '}• {syncStatus.conflictCount} conflicts
                                        </span>
                                    )}
                                    {syncStatus.lastSync && (
                                        <span className="text-gray-500">
                                            {' '}• Last sync: {formatDate(syncStatus.lastSync)}
                                        </span>
                                    )}
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                        aria-label="Close abstract manager"
                    >
                        ×
                    </button>
                </div>

                {/* Controls */}
                <div className="p-6 border-b bg-gray-50">
                    <div className="flex flex-wrap gap-4 items-center">
                        {/* Search */}
                        <div className="flex-1 min-w-64">
                            <input
                                type="text"
                                placeholder="Search abstracts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Search abstracts by title, impact, synopsis, or keywords"
                            />
                        </div>

                        {/* Filters */}
                        <select
                            value={selectedConference}
                            onChange={(e) => setSelectedConference(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Filter by conference"
                        >
                            <option value="all">All Conferences</option>
                            <option value="ISMRM">ISMRM</option>
                            <option value="RSNA">RSNA</option>
                            <option value="JACC">JACC</option>
                        </select>

                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Filter by abstract type"
                        >
                            <option value="all">All Types</option>
                            <option value="Standard Abstract">Standard</option>
                            <option value="MRI in Clinical Practice Abstract">Clinical Practice</option>
                            <option value="ISMRT Abstract">ISMRT</option>
                            <option value="Registered Abstract">Registered</option>
                        </select>

                        {/* Sort */}
                        <select
                            value={`${sortBy}-${sortOrder}`}
                            onChange={(e) => {
                                const [by, order] = e.target.value.split('-');
                                setSortBy(by as 'date' | 'title' | 'conference');
                                setSortOrder(order as 'asc' | 'desc');
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Sort abstracts"
                        >
                            <option value="date-desc">Newest First</option>
                            <option value="date-asc">Oldest First</option>
                            <option value="title-asc">Title A-Z</option>
                            <option value="title-desc">Title Z-A</option>
                            <option value="conference-asc">Conference A-Z</option>
                        </select>

                        {/* Actions */}
                        <button
                            onClick={exportAbstracts}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        >
                            Export
                        </button>

                        <label className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer">
                            Import
                            <input
                                type="file"
                                accept=".json"
                                onChange={importAbstracts}
                                className="hidden"
                            />
                        </label>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-lg text-gray-600">Loading abstracts...</div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-red-600 text-center">
                                <p className="text-lg font-semibold">Error</p>
                                <p>{error}</p>
                                <button
                                    onClick={loadAbstracts}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    ) : filteredAbstracts.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500 text-center">
                                <p className="text-lg">No abstracts found</p>
                                <p className="text-sm mt-2">
                                    {searchQuery || selectedConference !== 'all' || selectedType !== 'all'
                                        ? 'Try adjusting your filters'
                                        : 'Create your first abstract to get started'
                                    }
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto">
                            <div className="grid gap-4 p-6">
                                {filteredAbstracts.map((abstract) => (
                                    <div
                                        key={abstract.id}
                                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        {abstract.title}
                                                    </h3>
                                                    <span
                                                        className="px-2 py-1 text-xs font-medium text-white rounded"
                                                        style={{ backgroundColor: getConferenceColor(abstract.conference) }}
                                                    >
                                                        {abstract.conference}
                                                    </span>
                                                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                                        {abstract.abstractType.replace(' Abstract', '')}
                                                    </span>
                                                </div>
                                                
                                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                                    {abstract.abstractData.impact}
                                                </p>
                                                
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span>Updated: {formatDate(abstract.updatedAt)}</span>
                                                    <span>Keywords: {abstract.keywords.length}</span>
                                                    {abstract.userId && (
                                                        <span className="text-green-600">☁️ Synced</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2 ml-4">
                                                <button
                                                    onClick={() => handleLoadAbstract(abstract)}
                                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                                >
                                                    Load
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(abstract.id)}
                                                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Confirm Delete
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this abstract? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteAbstract(showDeleteConfirm)}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};