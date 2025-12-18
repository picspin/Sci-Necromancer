<template>
  <button
    type="button"
    :class="[
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      fullWidth ? 'w-full' : '',
      $attrs.class,
    ]"
    :disabled="disabled || loading"
    :aria-busy="loading"
    :aria-disabled="disabled || loading"
    @click="handleClick"
    @keydown="handleKeyDown"
  >
    <!-- Loading spinner -->
    <SvgIcon
      v-if="loading"
      type="loader"
      :class="[iconSizeClasses[size], 'animate-spin']"
      aria-hidden="true"
    />

    <!-- Icon left -->
    <SvgIcon
      v-if="!loading && icon && iconPosition === 'left'"
      :type="icon"
      :class="iconSizeClasses[size]"
      aria-hidden="true"
    />

    <!-- Content -->
    <span><slot /></span>

    <!-- Icon right -->
    <SvgIcon
      v-if="!loading && icon && iconPosition === 'right'"
      :type="icon"
      :class="iconSizeClasses[size]"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue';

type IconType =
  | 'text'
  | 'image'
  | 'document'
  | 'sparkles'
  | 'loader'
  | 'info'
  | 'impact'
  | 'tag'
  | 'logo';

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconType;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  iconPosition: 'left',
  loading: false,
  fullWidth: false,
  disabled: false,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed';

const variantClasses = {
  primary: 'bg-brand-primary hover:bg-brand-secondary text-white',
  secondary: 'bg-base-300 hover:bg-base-300/80 text-white',
  ghost: 'bg-transparent hover:bg-base-300/50 text-text-secondary hover:text-text-primary',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

const sizeClasses = {
  sm: 'py-1.5 px-3 text-sm min-h-[36px]',
  md: 'py-2.5 px-4 text-base min-h-[44px]',
  lg: 'py-3 px-6 text-lg min-h-[52px]',
};

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const handleClick = (e: MouseEvent) => {
  if (props.loading || props.disabled) {
    e.preventDefault();
    return;
  }
  emit('click', e);
};

const handleKeyDown = (e: KeyboardEvent) => {
  // Ensure Enter and Space trigger the button
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!props.loading && !props.disabled) {
      emit('click', e as any);
    }
  }
};
</script>
