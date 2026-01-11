<template>
  <div class="relative">
    <!-- Stacked Preview Container -->
    <div
      v-if="images.length > 0"
      class="relative w-full h-32 cursor-pointer"
      @click="$emit('click')"
    >
      <!-- Stacked images (show up to 3 visible in stack) -->
      <div
        v-for="(image, index) in visibleStackImages"
        :key="image.id"
        class="absolute rounded-lg border-2 border-base-300 overflow-hidden shadow-md transition-all duration-200 hover:shadow-lg"
        :style="getStackStyle(index)"
      >
        <img
          :src="image.previewUrl"
          :alt="`Reference image ${index + 1}`"
          class="w-full h-full object-cover"
        />
        <!-- Remove button on top image -->
        <button
          v-if="index === 0"
          @click.stop="$emit('remove', image.id)"
          class="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
          :title="t('image_generation.remove_image')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="w-3 h-3"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Count badge -->
      <div
        v-if="images.length > 1"
        class="absolute -top-2 -right-2 bg-brand-primary text-white text-xs font-bold px-2 py-1 rounded-full shadow-md z-10"
      >
        {{ images.length }}/{{ maxImages }}
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="w-full h-32 border-2 border-dashed border-base-300 rounded-lg flex items-center justify-center text-text-secondary"
    >
      <div class="text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-8 h-8 mx-auto mb-1 opacity-50"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
        <span class="text-xs">{{ t('image_generation.no_images') }}</span>
      </div>
    </div>

    <!-- Image list (expandable) -->
    <Transition name="slide">
      <div v-if="expanded && images.length > 0" class="mt-2 space-y-2">
        <div
          v-for="(image, index) in images"
          :key="image.id"
          class="flex items-center gap-2 p-2 bg-base-100 rounded-lg"
        >
          <img
            :src="image.previewUrl"
            :alt="`Image ${index + 1}`"
            class="w-12 h-12 object-cover rounded"
          />
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-text-primary truncate">{{ image.file.name }}</p>
            <p class="text-xs text-text-secondary">{{ image.sizeInMB }} MB</p>
          </div>
          <button
            @click="$emit('remove', image.id)"
            class="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="w-4 h-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Expand/Collapse toggle -->
    <button
      v-if="images.length > 1"
      @click="expanded = !expanded"
      class="mt-2 text-xs text-brand-primary hover:underline flex items-center gap-1"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="w-3 h-3 transition-transform"
        :class="{ 'rotate-180': expanded }"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
      {{ expanded ? t('image_generation.collapse_list') : t('image_generation.expand_list') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { UploadedImage } from '@/types';

const { t } = useI18n();

const props = defineProps<{
  images: UploadedImage[];
  maxImages: number;
}>();

defineEmits<{
  click: [];
  remove: [imageId: string];
}>();

const expanded = ref(false);

// Show up to 3 images in the visual stack
const visibleStackImages = computed(() => {
  return props.images.slice(0, 3);
});

// Generate stacked card styles
const getStackStyle = (index: number) => {
  const baseWidth = 100; // percentage
  const baseHeight = 100; // percentage
  const offsetX = index * 8; // pixels
  const offsetY = index * 6; // pixels
  const scale = 1 - index * 0.05;
  const zIndex = 10 - index;

  return {
    width: `${baseWidth - index * 10}%`,
    height: `${baseHeight - index * 8}%`,
    left: `${offsetX}px`,
    top: `${offsetY}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    zIndex,
    opacity: 1 - index * 0.15,
  };
};
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
