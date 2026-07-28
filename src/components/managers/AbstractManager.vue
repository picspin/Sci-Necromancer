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
              {{ t('abstract_manager.title') }}
            </h2>
            <p class="text-sm text-gray-600 mt-1">
              {{ t('abstract_manager.saved_count', { count: abstracts.length }) }}
              <template v-if="syncStatus">
                <span class="ml-2">
                  •
                  {{
                    syncStatus.isOnline
                      ? `🟢 ${t('abstract_manager.online')}`
                      : `🔴 ${t('abstract_manager.offline')}`
                  }}
                  <span v-if="syncStatus.pendingChanges > 0" class="text-orange-600">
                    • {{ t('abstract_manager.pending_sync', { count: syncStatus.pendingChanges }) }}
                  </span>
                  <span v-if="syncStatus.conflictCount > 0" class="text-red-600">
                    • {{ t('abstract_manager.conflicts', { count: syncStatus.conflictCount }) }}
                  </span>
                  <span v-if="syncStatus.lastSync" class="text-gray-500">
                    • {{ t('abstract_manager.last_sync') }}: {{ formatDate(syncStatus.lastSync) }}
                  </span>
                </span>
              </template>
            </p>
          </div>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            :aria-label="t('abstract_manager.close')"
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
                :placeholder="t('abstract_manager.search_placeholder')"
                v-model="searchQuery"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                :aria-label="t('abstract_manager.search_label')"
              />
            </div>

            <!-- Filters -->
            <select
              v-model="selectedConference"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :aria-label="t('abstract_manager.filter_conference')"
            >
              <option value="all">{{ t('abstract_manager.all_conferences') }}</option>
              <option value="ISMRM">ISMRM</option>
              <option value="RSNA">RSNA</option>
              <option value="ER">ER</option>
              <option value="ESC">ESC</option>
            </select>

            <select
              v-model="selectedType"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :aria-label="t('abstract_manager.filter_type')"
            >
              <option value="all">{{ t('abstract_manager.all_types') }}</option>
              <option value="Standard Abstract">{{ t('abstract_manager.standard') }}</option>
              <option value="MRI in Clinical Practice Abstract">
                {{ t('abstract_manager.clinical_practice') }}
              </option>
              <option value="ISMRT Abstract">ISMRT</option>
              <option value="Registered Abstract">{{ t('abstract_manager.registered') }}</option>
            </select>

            <!-- Sort -->
            <select
              :value="`${sortBy}-${sortOrder}`"
              @change="handleSortChange"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :aria-label="t('abstract_manager.sort_label')"
            >
              <option value="date-desc">{{ t('abstract_manager.newest') }}</option>
              <option value="date-asc">{{ t('abstract_manager.oldest') }}</option>
              <option value="title-asc">{{ t('abstract_manager.title_az') }}</option>
              <option value="title-desc">{{ t('abstract_manager.title_za') }}</option>
              <option value="conference-asc">{{ t('abstract_manager.conference_az') }}</option>
            </select>

            <!-- Actions -->
            <button
              @click="exportAbstracts"
              class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              :aria-label="t('abstract_manager.export_all')"
              :title="t('abstract_manager.export_help')"
            >
              {{ t('abstract_manager.export') }}
            </button>

            <label
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
              :title="t('abstract_manager.import_help')"
            >
              {{ t('abstract_manager.import') }}
              <input
                type="file"
                accept=".json"
                @change="importAbstracts"
                class="hidden"
                :aria-label="t('abstract_manager.import_label')"
              />
            </label>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden">
          <div v-if="loading" class="flex items-center justify-center h-full">
            <div class="text-lg text-gray-600">{{ t('abstract_manager.loading') }}</div>
          </div>

          <div v-else-if="error" class="flex items-center justify-center h-full">
            <div class="text-red-600 text-center">
              <p class="text-lg font-semibold">{{ t('common.error') }}</p>
              <p>{{ error }}</p>
              <button
                @click="loadAbstracts"
                class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {{ t('abstract_manager.retry') }}
              </button>
            </div>
          </div>

          <div
            v-else-if="filteredAbstracts.length === 0"
            class="flex items-center justify-center h-full"
          >
            <div class="text-gray-500 text-center">
              <p class="text-lg">{{ t('abstract_manager.no_results') }}</p>
              <p class="text-sm mt-2">
                {{
                  searchQuery || selectedConference !== 'all' || selectedType !== 'all'
                    ? t('abstract_manager.adjust_filters')
                    : t('abstract_manager.create_first')
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
                      <span
                        >{{ t('abstract_manager.updated') }}:
                        {{ formatDate(abstract.updatedAt) }}</span
                      >
                      <span>{{ t('output.keywords') }}: {{ abstract.keywords.length }}</span>
                      <span v-if="abstract.userId" class="text-green-600"
                        >☁️ {{ t('abstract_manager.synced') }}</span
                      >
                    </div>
                  </div>

                  <div class="flex gap-2 ml-4">
                    <button
                      @click="handleLoadAbstract(abstract)"
                      class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      :aria-label="t('abstract_manager.load_named', { title: abstract.title })"
                      :title="t('abstract_manager.load_help')"
                    >
                      {{ t('abstract_manager.load') }}
                    </button>
                    <button
                      @click="showDeleteConfirm = abstract.id"
                      class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      :aria-label="t('abstract_manager.delete_named', { title: abstract.title })"
                      :title="t('abstract_manager.delete_help')"
                    >
                      {{ t('abstract_manager.delete') }}
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
            {{ t('abstract_manager.confirm_delete') }}
          </h3>
          <p class="text-gray-600 mb-6">
            {{ t('abstract_manager.delete_warning') }}
          </p>
          <div class="flex gap-3 justify-end">
            <button
              @click="showDeleteConfirm = null"
              class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              :aria-label="t('abstract_manager.cancel_delete')"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              @click="handleDeleteAbstract(showDeleteConfirm)"
              class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              :aria-label="t('abstract_manager.confirm_delete')"
              ref="deleteConfirmButton"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SavedAbstract, SyncStatus } from '@/types';
import { useSettings } from '@/composables/useSettings';
import { useAbstract } from '@/composables/useAbstract';
import { localizeError } from '@/lib/i18n/errorMessages';

const { t, locale } = useI18n();

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
    error.value = localizeError(err, t, 'errors.load_failed');
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
    error.value = localizeError(err, t, 'errors.delete_failed');
  }
};

const handleLoadAbstract = (abstract: SavedAbstract) => {
  loadAbstractToContext(abstract);
  emit('close');
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat(locale.value.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US', {
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
    error.value = localizeError(err, t, 'errors.export_failed');
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
    error.value = localizeError(err, t, 'errors.import_failed');
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
