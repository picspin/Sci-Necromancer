<template>
  <div class="relative w-1/2 group">
    <button
      @click="emit('click')"
      :disabled="disabled"
      :class="[
        'w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-300',
        active
          ? 'bg-brand-primary text-white shadow-md'
          : 'text-text-secondary hover:bg-base-200/50',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ]"
    >
      <SvgIcon :type="icon" class="h-5 w-5" />{{ label }}
    </button>
    <span
      v-if="disabled && tooltip"
      class="absolute bottom-full z-10 mb-2 w-max bg-base-300 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
    >
      {{ tooltip }}
    </span>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/ui/SvgIcon.vue';

interface Props {
  label: string;
  icon: 'document' | 'sparkles';
  active: boolean;
  disabled?: boolean;
  tooltip?: string;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  click: [];
}>();
</script>
