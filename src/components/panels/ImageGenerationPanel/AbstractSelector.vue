<template>
  <div class="bg-base-100 rounded-lg p-4">
    <div class="flex items-center justify-between mb-3">
      <label class="block text-sm font-medium text-text-secondary">
        {{ t('image_generation.load_abstract') }}
      </label>
    </div>

    <!-- Selected abstract display -->
    <div v-if="selectedAbstract" class="mb-4">
      <div class="bg-brand-primary/10 border border-brand-primary/30 rounded-lg p-3">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h4 class="font-medium text-text-primary">{{ selectedAbstract.title }}</h4>
            <p class="text-xs text-text-secondary mt-1">
              {{ selectedAbstract.conference }} - {{ selectedAbstract.abstractType }}
            </p>
            <p class="text-sm text-text-secondary mt-2 line-clamp-2">
              {{ selectedAbstract.abstractData.impact }}
            </p>
          </div>
          <button
            @click="clearSelection"
            class="ml-2 p-1 text-text-secondary hover:text-red-500 transition-colors"
            :title="t('image_generation.clear_intent')"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-5 h-5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Load button -->
    <button
      @click="showModal = true"
      class="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-base-300 rounded-lg hover:border-brand-primary hover:bg-brand-primary/5 transition-all text-text-secondary hover:text-brand-primary"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-5 h-5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
      {{
        selectedAbstract
          ? t('image_generation.select_abstract')
          : t('image_generation.load_abstract')
      }}
    </button>

    <!-- Abstract selection modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        @click.self="showModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          <!-- Modal header -->
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="text-lg font-semibold">{{ t('image_generation.select_abstract') }}</h3>
            <button @click="showModal = false" class="text-text-secondary hover:text-text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-6 h-6"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Search -->
          <div class="p-4 border-b">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('common.search') + '...'"
              class="w-full px-3 py-2 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none"
            />
          </div>

          <!-- Abstract list -->
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="loading" class="text-center py-8 text-text-secondary">
              {{ t('common.loading') }}
            </div>

            <div
              v-else-if="filteredAbstracts.length === 0"
              class="text-center py-8 text-text-secondary"
            >
              <p>{{ t('image_generation.no_abstracts') }}</p>
            </div>

            <div v-else class="space-y-3">
              <button
                v-for="abstract in filteredAbstracts"
                :key="abstract.id"
                @click="selectAbstract(abstract)"
                class="w-full text-left p-4 border border-base-300 rounded-lg hover:border-brand-primary hover:bg-brand-primary/5 transition-all"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-text-primary">{{ abstract.title }}</h4>
                    <p class="text-xs text-text-secondary mt-1">
                      {{ abstract.conference }} - {{ formatDate(abstract.updatedAt) }}
                    </p>
                  </div>
                  <span
                    class="px-2 py-1 text-xs rounded-full"
                    :style="{
                      backgroundColor: getConferenceColor(abstract.conference) + '20',
                      color: getConferenceColor(abstract.conference),
                    }"
                  >
                    {{ abstract.conference }}
                  </span>
                </div>
                <p class="text-sm text-text-secondary mt-2 line-clamp-2">
                  {{ abstract.abstractData.impact }}
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SavedAbstract, Conference } from '@/types';
import { useSettings } from '@/composables/useSettings';

const { t } = useI18n();

interface Props {
  selectedAbstract: SavedAbstract | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [abstract: SavedAbstract];
  clear: [];
}>();

const { databaseService } = useSettings();

const showModal = ref(false);
const loading = ref(false);
const abstracts = ref<SavedAbstract[]>([]);
const searchQuery = ref('');

// Load abstracts when modal opens
watch(showModal, async (isOpen) => {
  if (isOpen) {
    loading.value = true;
    try {
      abstracts.value = await databaseService.listAbstracts();
    } catch (err) {
      console.error('Failed to load abstracts:', err);
      abstracts.value = [];
    } finally {
      loading.value = false;
    }
  }
});

const filteredAbstracts = computed(() => {
  if (!searchQuery.value.trim()) {
    return abstracts.value;
  }

  const query = searchQuery.value.toLowerCase();
  return abstracts.value.filter(
    (abstract) =>
      abstract.title.toLowerCase().includes(query) ||
      abstract.abstractData.impact.toLowerCase().includes(query) ||
      abstract.abstractData.synopsis.toLowerCase().includes(query) ||
      abstract.keywords.some((k) => k.toLowerCase().includes(query))
  );
});

const selectAbstract = (abstract: SavedAbstract) => {
  emit('select', abstract);
  showModal.value = false;
};

const clearSelection = () => {
  emit('clear');
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const getConferenceColor = (conference: Conference): string => {
  const colors: Record<Conference, string> = {
    ISMRM: '#4CAF50',
    RSNA: '#2196F3',
    ER: '#9C27B0',
    ESC: '#C41E3A',
  };
  return colors[conference] || '#9E9E9E';
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
