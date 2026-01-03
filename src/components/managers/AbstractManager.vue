<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="abstract-manager-title"
      @click.self="$emit('close')"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b">
          <div>
            <h2 id="abstract-manager-title" class="text-2xl font-bold text-gray-900">
              Abstract Manager
            </h2>
            <p class="text-sm text-gray-600 mt-1">
              {{ abstracts.length }} abstracts saved
              <template v-if="syncStatus">
                <span class="ml-2">
                  • {{ syncStatus.isOnline ? '🟢 Online' : '🔴 Offline' }}
                  <span v-if="syncStatus.pendingChanges > 0" class="text-orange-600">
                    • {{ syncStatus.pendingChanges }} pending sync
                  </span>
                  <span v-if="syncStatus.conflictCount > 0" class="text-red-600">
                    • {{ syncStatus.conflictCount }} conflicts
                  </span>
                  <span v-if="syncStatus.lastSync" class="text-gray-500">
                    • Last sync: {{ formatDate(syncStatus.lastSync) }}
                  </span>
                </span>
              </template>
            </p>
          </div>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label="Close abstract manager"
          >
            ×
          </button>
        </div>

        <!-- Controls -->
        <div class="p-6 border-b bg-gray-50">
          <div class="flex flex-wrap gap-4 items-center">
            <!-- Search -->
            <div class="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search abstracts..."
                v-model="searchQuery"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Search abstracts by title, impact, synopsis, or keywords"
              />
            </div>

            <!-- Filters -->
            <select
              v-model="selectedConference"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by conference"
            >
              <option value="all">All Conferences</option>
              <option value="ISMRM">ISMRM</option>
              <option value="RSNA">RSNA</option>
              <option value="ER">ER</option>
              <option value="ESC">ESC</option>
            </select>

            <select
              v-model="selectedType"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by abstract type"
            >
              <option value="all">All Types</option>
              <option value="Standard Abstract">Standard</option>
              <option value="MRI in Clinical Practice Abstract">Clinical Practice</option>
              <option value="ISMRT Abstract">ISMRT</option>
              <option value="Registered Abstract">Registered</option>
            </select>

            <!-- Sort -->
            <select
              :value="`${sortBy}-${sortOrder}`"
              @change="handleSortChange"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Sort abstracts"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
              <option value="conference-asc">Conference A-Z</option>
            </select>

            <!-- Actions -->
            <button
              @click="exportAbstracts"
              class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              aria-label="Export all abstracts to JSON file"
              title="Export all abstracts as a backup file"
            >
              Export
            </button>

            <label
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
              title="Import abstracts from a backup file"
            >
              Import
              <input
                type="file"
                accept=".json"
                @change="importAbstracts"
                class="hidden"
                aria-label="Import abstracts from JSON file"
              />
            </label>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden">
          <div v-if="loading" class="flex items-center justify-center h-full">
            <div class="text-lg text-gray-600">Loading abstracts...</div>
          </div>

          <div v-else-if="error" class="flex items-center justify-center h-full">
            <div class="text-red-600 text-center">
              <p class="text-lg font-semibold">Error</p>
              <p>{{ error }}</p>
              <button
                @click="loadAbstracts"
                class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>

          <div
            v-else-if="filteredAbstracts.length === 0"
            class="flex items-center justify-center h-full"
          >
            <div class="text-gray-500 text-center">
              <p class="text-lg">No abstracts found</p>
              <p class="text-sm mt-2">
                {{
                  searchQuery || selectedConference !== 'all' || selectedType !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first abstract to get started'
                }}
              </p>
            </div>
          </div>

          <div v-else class="h-full overflow-y-auto">
            <div class="grid gap-4 p-6">
              <div
                v-for="abstract in filteredAbstracts"
                :key="abstract.id"
                class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <h3 class="text-lg font-semibold text-gray-900">
                        {{ abstract.title }}
                      </h3>
                      <span
                        class="px-2 py-1 text-xs font-medium text-white rounded"
                        :style="{ backgroundColor: getConferenceColor(abstract.conference) }"
                      >
                        {{ abstract.conference }}
                      </span>
                      <span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                        {{ abstract.abstractType.replace(' Abstract', '') }}
                      </span>
                    </div>

                    <p class="text-sm text-gray-600 mb-2 line-clamp-2">
                      {{ abstract.abstractData.impact }}
                    </p>

                    <div class="flex items-center gap-4 text-xs text-gray-500">
                      <span>Updated: {{ formatDate(abstract.updatedAt) }}</span>
                      <span>Keywords: {{ abstract.keywords.length }}</span>
                      <span v-if="abstract.userId" class="text-green-600">☁️ Synced</span>
                    </div>
                  </div>

                  <div class="flex gap-2 ml-4">
                    <button
                      @click="handleLoadAbstract(abstract)"
                      class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      :aria-label="`Load abstract: ${abstract.title}`"
                      title="Load this abstract into the editor"
                    >
                      Load
                    </button>
                    <button
                      @click="showDeleteConfirm = abstract.id"
                      class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      :aria-label="`Delete abstract: ${abstract.title}`"
                      title="Delete this abstract permanently"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        @click.self="showDeleteConfirm = null"
        @keydown.esc="showDeleteConfirm = null"
      >
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 id="delete-confirm-title" class="text-lg font-semibold text-gray-900 mb-4">
            Confirm Delete
          </h3>
          <p class="text-gray-600 mb-6">
            Are you sure you want to delete this abstract? This action cannot be undone.
          </p>
          <div class="flex gap-3 justify-end">
            <button
              @click="showDeleteConfirm = null"
              class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              aria-label="Cancel delete operation"
            >
              Cancel
            </button>
            <button
              @click="handleDeleteAbstract(showDeleteConfirm)"
              class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              aria-label="Confirm delete abstract"
              ref="deleteConfirmButton"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { SavedAbstract, SyncStatus } from '@/types';
import { useSettings } from '@/composables/useSettings';
import { useAbstract } from '@/composables/useAbstract';

interface Props {
  isVisible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const { databaseService } = useSettings();
const { loadAbstract: loadAbstractToContext } = useAbstract();

// State
const abstracts = ref<SavedAbstract[]>([]);
const filteredAbstracts = ref<SavedAbstract[]>([]);
const searchQuery = ref('');
const selectedConference = ref<string>('all');
const selectedType = ref<string>('all');
const sortBy = ref<'date' | 'title' | 'conference'>('date');
const sortOrder = ref<'asc' | 'desc'>('desc');
const loading = ref(false);
const error = ref<string | null>(null);
const syncStatus = ref<SyncStatus | null>(null);
const showDeleteConfirm = ref<string | null>(null);
const deleteConfirmButton = ref<HTMLButtonElement | null>(null);

// Load abstracts when visible
watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      loadAbstracts();
      loadSyncStatus();
    }
  },
  { immediate: true }
);

// Handle Escape key to close modal
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isVisible && !showDeleteConfirm.value) {
    emit('close');
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleEscape);
  // Also load abstracts on mount if visible
  if (props.isVisible) {
    console.log('onMounted: Loading abstracts because isVisible is true');
    loadAbstracts();
    loadSyncStatus();
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
});

// Filter and sort abstracts when inputs change
watch(
  [abstracts, searchQuery, selectedConference, selectedType, sortBy, sortOrder],
  () => {
    filterAndSortAbstracts();
  },
  { deep: true }
);

// Auto-focus delete button when confirmation modal opens
watch(showDeleteConfirm, (value) => {
  if (value) {
    nextTick(() => {
      deleteConfirmButton.value?.focus();
    });
  }
});

const loadAbstracts = async () => {
  loading.value = true;
  error.value = null;
  try {
    console.log('Loading abstracts...');
    console.log('databaseService:', databaseService);
    console.log('databaseService.listAbstracts:', typeof databaseService.listAbstracts);
    const loadedAbstracts = await databaseService.listAbstracts();
    console.log('Loaded abstracts:', loadedAbstracts);
    console.log('Loaded abstracts length:', loadedAbstracts?.length);
    abstracts.value = loadedAbstracts;
    console.log('abstracts.value set to:', abstracts.value.length, 'items');
  } catch (err) {
    console.error('Error loading abstracts:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load abstracts';
  } finally {
    loading.value = false;
  }
};

const loadSyncStatus = async () => {
  try {
    // Check if getSyncStatus method exists (optional method)
    const service = databaseService as any;
    if (service.getSyncStatus && typeof service.getSyncStatus === 'function') {
      const status = await service.getSyncStatus();
      syncStatus.value = status;
    } else {
      // Default sync status for local-only mode
      syncStatus.value = {
        isOnline: false,
        lastSync: null,
        pendingChanges: 0,
        conflictCount: 0,
      };
    }
  } catch (err) {
    console.error('Failed to load sync status:', err);
    // Set default status on error
    syncStatus.value = {
      isOnline: false,
      lastSync: null,
      pendingChanges: 0,
      conflictCount: 0,
    };
  }
};

const filterAndSortAbstracts = () => {
  console.log('filterAndSortAbstracts called, abstracts.value:', abstracts.value.length);
  let filtered = [...abstracts.value];

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (abstract) =>
        abstract.title.toLowerCase().includes(query) ||
        abstract.abstractData.impact.toLowerCase().includes(query) ||
        abstract.abstractData.synopsis.toLowerCase().includes(query) ||
        abstract.keywords.some((keyword) => keyword.toLowerCase().includes(query))
    );
  }

  // Apply conference filter
  if (selectedConference.value !== 'all') {
    filtered = filtered.filter((abstract) => abstract.conference === selectedConference.value);
  }

  // Apply type filter
  if (selectedType.value !== 'all') {
    filtered = filtered.filter((abstract) => abstract.abstractType === selectedType.value);
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let comparison = 0;

    switch (sortBy.value) {
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

    return sortOrder.value === 'asc' ? comparison : -comparison;
  });

  filteredAbstracts.value = filtered;
  console.log('filteredAbstracts set to:', filteredAbstracts.value.length, 'items');
};

const handleSortChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  const [by, order] = target.value.split('-');
  sortBy.value = by as 'date' | 'title' | 'conference';
  sortOrder.value = order as 'asc' | 'desc';
};

const handleDeleteAbstract = async (id: string) => {
  try {
    await databaseService.deleteAbstract(id);
    abstracts.value = abstracts.value.filter((abstract) => abstract.id !== id);
    showDeleteConfirm.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete abstract';
  }
};

const handleLoadAbstract = (abstract: SavedAbstract) => {
  loadAbstractToContext(abstract);
  emit('close');
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getConferenceColor = (conference: string) => {
  switch (conference) {
    case 'ISMRM':
      return '#4CAF50';
    case 'RSNA':
      return '#2196F3';
    case 'ER':
      return '#9C27B0';
    case 'ESC':
      return '#C41E3A';
    default:
      return '#9E9E9E';
  }
};

const exportAbstracts = async () => {
  try {
    // Check if exportData method exists (LocalStorageService or UnifiedDatabaseService)
    const service = databaseService as any;
    if ('exportData' in service && typeof service.exportData === 'function') {
      const exportData = await service.exportData();
      downloadJSON(
        exportData,
        `sci-necromancer-abstracts-${new Date().toISOString().split('T')[0]}.json`
      );
    } else {
      // Fallback: export abstracts manually
      const abstracts = await databaseService.listAbstracts();
      const exportData = JSON.stringify(
        {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          abstracts,
          metadata: {},
        },
        null,
        2
      );
      downloadJSON(
        exportData,
        `sci-necromancer-abstracts-${new Date().toISOString().split('T')[0]}.json`
      );
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to export abstracts';
  }
};

const downloadJSON = (data: string, filename: string) => {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const importAbstracts = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();

    // Check if importData method exists (LocalStorageService or UnifiedDatabaseService)
    const service = databaseService as any;
    if ('importData' in service && typeof service.importData === 'function') {
      await service.importData(text);
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
            syncStatus: abstract.syncStatus,
          });
        } catch (err) {
          console.error('Failed to import abstract:', abstract.title, err);
        }
      }
    }

    await loadAbstracts();
    // Reset the file input
    target.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to import abstracts';
  }
};
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
