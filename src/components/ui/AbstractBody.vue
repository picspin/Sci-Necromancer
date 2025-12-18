<template>
  <div class="space-y-4">
    <template v-for="(section, index) in parsedSections" :key="index">
      <div v-if="section.header">
        <h4 class="font-bold text-brand-primary mb-2">{{ section.header }}</h4>
        <p class="text-text-secondary leading-relaxed">{{ section.body }}</p>
      </div>
      <p v-else class="text-text-secondary leading-relaxed">{{ section.body }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  content: string;
}

const props = defineProps<Props>();

interface ParsedSection {
  header?: string;
  body: string;
}

const parsedSections = computed<ParsedSection[]>(() => {
  const sections = props.content.split(/\n\n+/);

  return sections.map((section) => {
    // Check if section starts with a header (all caps followed by colon)
    const headerMatch = section.match(/^([A-Z\s&]+):\s*/);
    if (headerMatch) {
      const header = headerMatch[1];
      const body = section.substring(headerMatch[0].length);
      return { header, body };
    }
    return { body: section };
  });
});
</script>
