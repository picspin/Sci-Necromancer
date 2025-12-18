<template>
  <button
    @click="emit('setActive', id)"
    :class="[
      'flex items-center gap-2 text-sm font-medium py-2 px-4 rounded-t-lg transition-colors duration-200 focus:outline-none',
      activeTab === id
        ? 'border-b-2 border-brand-primary text-brand-primary'
        : 'text-text-secondary hover:bg-base-300/50',
    ]"
  >
    <SvgIcon :type="icon" class="h-5 w-5" />{{ label }}
  </button>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/ui/SvgIcon.vue';

interface Props {
  id: 'abstract' | 'figure';
  activeTab: string;
  label: string;
  icon: 'text' | 'image';
}

defineProps<Props>();

const emit = defineEmits<{
  setActive: [id: 'abstract' | 'figure'];
}>();
</script>
