<template>
  <div class="flex flex-col items-end gap-2">
    <div class="flex items-center gap-2">
      <button
        @click="handleExportMd"
        :disabled="!abstract || isExporting"
        class="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
        title="Export as Markdown (.md)"
        aria-label="Export as Markdown"
      >
        <SvgIcon type="download" class="h-4 w-4" />
        <span>MD</span>
      </button>
      <button
        @click="handleExportPdf"
        :disabled="!abstract || isExporting"
        class="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
        title="Export as PDF"
        aria-label="Export as PDF"
      >
        <SvgIcon type="download" class="h-4 w-4" />
        <span>PDF</span>
      </button>
      <button
        @click="handleExportJson"
        :disabled="!abstract || isExporting"
        class="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
        title="Export as JSON"
        aria-label="Export as JSON"
      >
        <SvgIcon type="download" class="h-4 w-4" />
        <span>JSON</span>
      </button>
    </div>
    <div v-if="exportError" class="text-xs text-red-400 animate-fade-in" role="alert">
      {{ exportError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { AbstractData, Conference, AbstractType } from '@/types';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import exportService from '@/services/exportService';
import { AI_EXPORT_DISCLAIMER } from '@/lib/compliance/aiDisclosure';

interface Props {
  abstract: AbstractData | null;
  conference?: Conference;
  abstractType?: AbstractType;
}

const props = withDefaults(defineProps<Props>(), {
  conference: 'ISMRM',
  abstractType: 'Standard Abstract',
});

const isExporting = ref(false);
const exportError = ref<string | null>(null);

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleExportMd = () => {
  if (!props.abstract) return;

  const content = `# ${props.abstractType}

## IMPACT

${props.abstract.impact}

---

## SYNOPSIS

${props.abstract.synopsis}

${
  props.abstract.abstract
    ? `---

## ABSTRACT

${props.abstract.abstract}

---`
    : ''
}

## KEYWORDS

${props.abstract.keywords.map((k) => `- ${k}`).join('\n')}

${
  props.abstract.categories
    ? `
---

## CATEGORIES

${props.abstract.categories.map((c) => `- ${c.name} (${c.type})`).join('\n')}
`
    : ''
}

---

## GENERATIVE AI NOTICE

${AI_EXPORT_DISCLAIMER}
  `;
  const blob = new Blob([content.trim()], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${props.conference.toLowerCase()}_abstract.md`);
};

const handleExportPdf = async () => {
  if (!props.abstract) return;

  isExporting.value = true;
  exportError.value = null;

  try {
    const blob = await exportService.exportToPDF(props.abstract, props.conference, {
      customTitle: props.abstractType,
    });
    downloadBlob(blob, `${props.conference.toLowerCase()}_abstract.pdf`);
  } catch (error) {
    console.error('PDF export error:', error);
    exportError.value = 'Failed to export PDF. Please try again.';
    setTimeout(() => (exportError.value = null), 3000);
  } finally {
    isExporting.value = false;
  }
};

const handleExportJson = () => {
  if (!props.abstract) return;

  const blob = exportService.exportToJSON(props.abstract, props.conference, props.abstractType);
  downloadBlob(blob, `${props.conference.toLowerCase()}_abstract.json`);
};
</script>
