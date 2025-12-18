<template>
  <div class="space-y-4">
    <h2 id="type-suggestion-title" class="text-xl font-bold text-text-primary">
      Recommended Abstract Type
    </h2>
    <p id="type-suggestion-description" class="text-text-secondary">
      Based on your content, we recommend the following abstract types. Please select one to
      proceed.
    </p>
    <p class="sr-only">Use arrow keys to navigate between options, Enter or Space to select</p>
    <div
      class="space-y-2"
      role="radiogroup"
      aria-labelledby="type-suggestion-title"
      aria-describedby="type-suggestion-description"
    >
      <button
        v-for="(suggestion, index) in validSuggestions"
        :key="suggestion.type"
        @click="handleSelect(suggestion.type)"
        @keydown="(e) => handleKeyDown(e, suggestion.type, index)"
        class="w-full text-left p-3 bg-base-100 hover:bg-base-300/50 border border-base-300 rounded-lg transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
        role="radio"
        :aria-checked="selectedIndex === index"
        :aria-label="`${suggestion.type} with ${(suggestion.probability * 100).toFixed(0)}% match probability`"
        tabindex="0"
      >
        <div class="flex justify-between items-center">
          <span class="font-semibold text-text-primary">{{ suggestion.type }}</span>
          <span class="text-xs font-mono px-2 py-1 bg-brand-primary/20 text-brand-primary rounded">
            {{ `${(suggestion.probability * 100).toFixed(0)}% match` }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { AbstractTypeSuggestion, AbstractType } from '@/types';

interface Props {
  suggestions: AbstractTypeSuggestion[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [type: AbstractType];
}>();

const selectedIndex = ref(0);

const validSuggestions = computed(() =>
  Array.isArray(props.suggestions) ? props.suggestions : []
);

const handleSelect = (type: AbstractType) => {
  emit('select', type);
};

const handleKeyDown = (e: KeyboardEvent, type: AbstractType, index: number) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    emit('select', type);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIndex = Math.min(index + 1, validSuggestions.value.length - 1);
    selectedIndex.value = nextIndex;
    // Focus next element
    const currentButton = e.currentTarget as HTMLButtonElement;
    const nextButton = currentButton.parentElement?.children[nextIndex] as HTMLButtonElement;
    nextButton?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevIndex = Math.max(index - 1, 0);
    selectedIndex.value = prevIndex;
    // Focus previous element
    const currentButton = e.currentTarget as HTMLButtonElement;
    const prevButton = currentButton.parentElement?.children[prevIndex] as HTMLButtonElement;
    prevButton?.focus();
  }
};
</script>
