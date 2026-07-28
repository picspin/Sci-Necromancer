<template>
  <div class="bg-base-100 rounded-lg p-4 h-full flex flex-col">
    <!-- Header with controls -->
    <div class="flex items-center justify-between mb-4 border-b border-base-300 pb-2">
      <h3 class="text-lg font-semibold text-text-primary flex items-center gap-2">
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
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
        {{ t('image_generation.preview') }}
      </h3>

      <!-- Zoom controls -->
      <div v-if="image" class="flex items-center gap-2">
        <button
          @click="$emit('zoom-out')"
          class="p-1.5 rounded hover:bg-base-200 transition-colors"
          :title="t('image_generation.zoom_out')"
          :disabled="zoomLevel <= 25"
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
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6"
            />
          </svg>
        </button>
        <span class="text-sm text-text-secondary min-w-[3rem] text-center">{{ zoomLevel }}%</span>
        <button
          @click="$emit('zoom-in')"
          class="p-1.5 rounded hover:bg-base-200 transition-colors"
          :title="t('image_generation.zoom_in')"
          :disabled="zoomLevel >= 200"
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
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6"
            />
          </svg>
        </button>
        <button
          @click="$emit('reset-zoom')"
          class="p-1.5 rounded hover:bg-base-200 transition-colors text-xs text-text-secondary"
          :title="t('image_generation.reset_zoom')"
        >
          {{ t('image_generation.reset_zoom') }}
        </button>
      </div>
    </div>

    <!-- Canvas area -->
    <div
      class="flex-1 overflow-auto flex items-center justify-center bg-base-200 rounded-lg min-h-[300px]"
      ref="canvasContainer"
    >
      <!-- Empty state -->
      <div v-if="!image && !isLoading" class="text-center text-text-secondary p-8">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1"
          stroke="currentColor"
          class="w-16 h-16 mx-auto mb-4 text-base-300"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
        <p class="text-lg font-medium">{{ t('image_generation.no_image_yet') }}</p>
        <p class="text-sm mt-1">{{ t('image_generation.click_generate') }}</p>
      </div>

      <!-- Loading state -->
      <div v-else-if="isLoading" class="text-center p-8">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"
        ></div>
        <p class="text-text-secondary">
          {{ loadingMessage || t('image_generation.loading_generating') }}
        </p>
      </div>

      <!-- Image display -->
      <div v-else class="p-4">
        <img
          :src="image"
          :alt="t('image_generation.generated_alt')"
          class="max-w-full h-auto rounded-lg shadow-lg transition-transform duration-200"
          :style="imageStyle"
        />
      </div>
    </div>

    <!-- Download button -->
    <div v-if="image && !isLoading" class="mt-4 flex justify-end">
      <button
        @click="$emit('download')"
        class="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg transition-colors"
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
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        {{ t('image_generation.download_image') }}
      </button>
    </div>

    <!-- Error display -->
    <div v-if="error" class="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
      <p class="font-medium">{{ t('common.error') }}</p>
      <p class="text-sm">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface Props {
  image: string | null;
  isLoading: boolean;
  loadingMessage?: string;
  error?: string | null;
  zoomLevel: number;
}

const props = withDefaults(defineProps<Props>(), {
  loadingMessage: '',
  error: null,
});

defineEmits<{
  download: [];
  'zoom-in': [];
  'zoom-out': [];
  'reset-zoom': [];
}>();

const canvasContainer = ref<HTMLElement | null>(null);

const imageStyle = computed(() => ({
  transform: `scale(${props.zoomLevel / 100})`,
  transformOrigin: 'center center',
}));
</script>

<style scoped>
/* Ensure smooth scrolling for zoomed images */
.overflow-auto {
  scroll-behavior: smooth;
}
</style>
