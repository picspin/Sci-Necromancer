<template>
  <label
    :for="fieldId"
    class="jumping-field"
    :class="[wrapperClass, { 'jumping-field--disabled': disabled }]"
  >
    <input
      :id="fieldId"
      v-bind="inputAttrs"
      :value="modelValue"
      :type="type"
      :disabled="disabled"
      placeholder=" "
      class="jumping-field__input"
      @input="updateValue"
    />
    <span class="jumping-field__label">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    label: string;
    id?: string;
    type?: string;
    disabled?: boolean;
    modelModifiers?: { number?: boolean; trim?: boolean };
  }>(),
  { modelValue: '', type: 'text', disabled: false, modelModifiers: () => ({}) }
);
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>();
const fieldId = props.id || useId();
const attrs = useAttrs();
const wrapperClass = computed(() => attrs.class);
const inputAttrs = computed(() => {
  const { class: _wrapperClass, ...attributes } = attrs;
  return attributes;
});

function updateValue(event: Event) {
  let value: string | number = (event.target as HTMLInputElement).value;
  if (props.modelModifiers.trim) value = String(value).trim();
  if (props.modelModifiers.number && value !== '') value = Number(value);
  emit('update:modelValue', value);
}
</script>

<style scoped>
.jumping-field {
  position: relative;
  display: block;
  min-width: 0;
  padding-top: 0.75rem;
}
.jumping-field__input {
  width: 100%;
  height: 2.75rem;
  padding: 0.5rem 0 0;
  border: 0;
  border-bottom: 1px solid #334155;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: #f1f5f9;
  font-size: 0.875rem;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease;
}
.jumping-field__input:focus {
  border-color: #007a7a;
  box-shadow: 0 1px 0 0 #007a7a;
}
.jumping-field__label {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 500;
  transform-origin: left center;
  transition:
    top 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}
.jumping-field__input:placeholder-shown:not(:focus) + .jumping-field__label {
  top: 1.5rem;
  font-size: 0.875rem;
  transform: scale(1);
}
.jumping-field__input:focus + .jumping-field__label,
.jumping-field__input:not(:placeholder-shown) + .jumping-field__label {
  top: 0;
  color: #007a7a;
  transform: scale(0.92);
}
.jumping-field--disabled {
  opacity: 0.5;
}
</style>
