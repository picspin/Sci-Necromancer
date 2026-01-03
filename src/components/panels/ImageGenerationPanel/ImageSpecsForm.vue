<template>
  <div class="bg-base-100 rounded-lg p-4">
    <div class="flex items-center justify-between mb-3">
      <label class="block text-sm font-medium text-text-secondary"> Image Specifications </label>
      <button
        v-if="parsedFields.length > 0"
        @click="toggleJsonPreview"
        class="text-xs text-brand-primary hover:underline"
      >
        {{ showJsonPreview ? 'Hide' : 'Show' }} JSON
      </button>
    </div>

    <!-- Smart text input with autocomplete -->
    <div class="relative">
      <textarea
        ref="textareaRef"
        :value="rawInput"
        @input="handleInput"
        @keydown="handleKeydown"
        @blur="handleBlur"
        placeholder="Describe your figure... e.g., 'Nature style, biomedical research, 2x2 grid layout, grayscale, labeled arrows'"
        class="w-full h-32 p-3 bg-base-200 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition resize-none text-sm"
      />

      <!-- Autocomplete dropdown -->
      <div
        v-if="showSuggestions && suggestions.length > 0"
        class="absolute z-50 w-full mt-1 bg-white border border-base-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
      >
        <button
          v-for="(suggestion, index) in suggestions"
          :key="suggestion.text"
          @mousedown.prevent="selectSuggestion(suggestion)"
          :class="[
            'w-full text-left px-3 py-2 text-sm hover:bg-base-100 transition-colors flex items-center justify-between',
            index === selectedSuggestionIndex ? 'bg-base-100' : '',
          ]"
        >
          <span>{{ suggestion.text }}</span>
          <span
            class="text-xs px-2 py-0.5 rounded-full"
            :class="getCategoryClass(suggestion.category)"
          >
            {{ suggestion.category }}
          </span>
        </button>
      </div>
    </div>

    <!-- Parsed fields preview -->
    <div v-if="parsedFields.length > 0" class="mt-3">
      <p class="text-xs text-text-secondary mb-2">Detected fields:</p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="field in parsedFields"
          :key="field.key"
          :class="[
            'px-2 py-1 text-xs rounded-full',
            field.isValid ? getCategoryClass(field.category) : 'bg-red-100 text-red-600',
          ]"
        >
          {{ field.key }}: {{ field.value }}
        </span>
      </div>
    </div>

    <!-- JSON preview (collapsible) -->
    <div v-if="showJsonPreview && parsedFields.length > 0" class="mt-3">
      <pre class="bg-base-200 p-3 rounded-md text-xs overflow-x-auto text-text-secondary">{{
        jsonOutput
      }}</pre>
    </div>

    <!-- Helper text -->
    <p class="text-xs text-text-secondary mt-2">
      Type keywords like <span class="font-mono bg-base-200 px-1 rounded">research</span>,
      <span class="font-mono bg-base-200 px-1 rounded">journal</span>,
      <span class="font-mono bg-base-200 px-1 rounded">layout</span>,
      <span class="font-mono bg-base-200 px-1 rounded">color</span> to get suggestions
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import type { ImageSpecField, CompletionSuggestion, ImageSpecCategory } from '@/types';

interface Props {
  rawInput: string;
  parsedFields: ImageSpecField[];
  jsonOutput: string;
  showSuggestions: boolean;
  suggestions: CompletionSuggestion[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:rawInput': [value: string, cursorPos: number];
  'select-suggestion': [suggestion: CompletionSuggestion];
  'hide-suggestions': [];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const showJsonPreview = ref(false);
const selectedSuggestionIndex = ref(0);

const toggleJsonPreview = () => {
  showJsonPreview.value = !showJsonPreview.value;
};

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:rawInput', target.value, target.selectionStart || 0);
  selectedSuggestionIndex.value = 0;
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.showSuggestions || props.suggestions.length === 0) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedSuggestionIndex.value = Math.min(
        selectedSuggestionIndex.value + 1,
        props.suggestions.length - 1
      );
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, 0);
      break;
    case 'Enter':
      if (props.suggestions[selectedSuggestionIndex.value]) {
        event.preventDefault();
        selectSuggestion(props.suggestions[selectedSuggestionIndex.value]);
      }
      break;
    case 'Escape':
      emit('hide-suggestions');
      break;
    case 'Tab':
      if (props.suggestions[selectedSuggestionIndex.value]) {
        event.preventDefault();
        selectSuggestion(props.suggestions[selectedSuggestionIndex.value]);
      }
      break;
  }
};

const handleBlur = () => {
  // Delay hiding suggestions to allow click events to fire
  setTimeout(() => {
    emit('hide-suggestions');
  }, 200);
};

const selectSuggestion = (suggestion: CompletionSuggestion) => {
  emit('select-suggestion', suggestion);
  selectedSuggestionIndex.value = 0;

  // Refocus textarea
  nextTick(() => {
    textareaRef.value?.focus();
  });
};

const getCategoryClass = (category: ImageSpecCategory): string => {
  const classes: Record<ImageSpecCategory, string> = {
    research: 'bg-purple-100 text-purple-700',
    journal: 'bg-blue-100 text-blue-700',
    layout: 'bg-green-100 text-green-700',
    style: 'bg-orange-100 text-orange-700',
    format: 'bg-gray-100 text-gray-700',
    elements: 'bg-pink-100 text-pink-700',
  };
  return classes[category] || 'bg-gray-100 text-gray-700';
};
</script>
