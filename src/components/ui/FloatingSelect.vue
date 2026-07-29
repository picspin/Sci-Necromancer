<template>
  <label
    :for="fieldId"
    class="floating-select"
    :class="[wrapperClass, { 'floating-select--disabled': disabled }]"
  >
    <span class="floating-select__icon" aria-hidden="true">
      <slot name="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M5 7h14M7 12h10M9 17h6" stroke-linecap="round" />
        </svg>
      </slot>
    </span>
    <span class="floating-select__label">{{ label }}</span>
    <select
      :id="fieldId"
      v-bind="selectAttrs"
      :value="modelValue"
      :disabled="disabled"
      class="floating-select__control"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue';

defineOptions({ inheritAttrs: false });

export interface FloatingSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    label: string;
    options: FloatingSelectOption[];
    id?: string;
    disabled?: boolean;
  }>(),
  { modelValue: '', disabled: false }
);
defineEmits<{ 'update:modelValue': [value: string] }>();
const fieldId = props.id || useId();
const attrs = useAttrs();
const wrapperClass = computed(() => attrs.class);
const selectAttrs = computed(() => {
  const { class: _wrapperClass, ...attributes } = attrs;
  return attributes;
});
</script>

<style scoped>
.floating-select {
  position: relative;
  display: block;
  min-width: 0;
  padding-top: 0.75rem;
}
.floating-select__icon {
  position: absolute;
  top: 1rem;
  left: 0;
  z-index: 10;
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid #334155;
  border-radius: 9999px;
  background: #1e293b;
  color: #007a7a;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}
.floating-select__icon :deep(svg) {
  width: 1rem;
  height: 1rem;
}
.floating-select__label {
  position: absolute;
  top: 0;
  left: 3rem;
  z-index: 10;
  pointer-events: none;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 500;
}
.floating-select__control {
  width: 100%;
  height: 3rem;
  padding: 0.5rem 2.25rem 0 3rem;
  appearance: none;
  border: 0;
  border-bottom: 1px solid #334155;
  border-radius: 0;
  outline: none;
  background-color: transparent;
  color: #f1f5f9;
  font-size: 0.875rem;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease;
  background-image:
    linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position:
    calc(100% - 15px) 55%,
    calc(100% - 10px) 55%;
  background-size:
    5px 5px,
    5px 5px;
  background-repeat: no-repeat;
}
.floating-select:focus-within .floating-select__icon {
  border-color: #007a7a;
  background: #007a7a;
  color: white;
}
.floating-select__control:focus {
  border-color: #007a7a;
  box-shadow: 0 1px 0 0 #007a7a;
}
.floating-select--disabled {
  opacity: 0.5;
}
</style>
