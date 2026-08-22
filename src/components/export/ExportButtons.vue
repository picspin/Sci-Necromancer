<template>
  <div class="flex flex-col items-end gap-2">
    <div class="flex items-center gap-2">
      <button
        @click="handleExportMd"
        :disabled="!abstract || isExporting"
        class="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
        :title="t('export.markdown_title')"
        :aria-label="t('export.markdown_label')"
      >
        <SvgIcon type="download" class="h-4 w-4" />
        <span>MD</span>
      </button>
      <button
        @click="handleExportPdf"
        :disabled="!abstract || isExporting"
        class="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
        :title="t('export.pdf_label')"
        :aria-label="t('export.pdf_label')"
      >
        <SvgIcon type="download" class="h-4 w-4" />
        <span>PDF</span>
      </button>
      <button
        @click="handleExportDocx"
        :disabled="!abstract || isExporting"
        class="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
        :title="t('export.docx_label')"
        :aria-label="t('export.docx_label')"
      >
        <SvgIcon type="download" class="h-4 w-4" />
        <span>DOCX</span>
      </button>
      <button
        @click="handleExportJson"
        :disabled="!abstract || isExporting"
        class="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
        :title="t('export.json_label')"
        :aria-label="t('export.json_label')"
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
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import SvgIcon from '@/components/ui/SvgIcon.vue';
import exportService from '@/services/exportService';

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

  const blob = exportService.exportToMarkdown(props.abstract, props.abstractType);
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
    exportError.value = t('errors.pdf_export_failed');
    setTimeout(() => (exportError.value = null), 3000);
  } finally {
    isExporting.value = false;
  }
};

const handleExportDocx = async () => {
  if (!props.abstract) return;

  isExporting.value = true;
  exportError.value = null;
  try {
    const blob = await exportService.exportToDocx(props.abstract, props.conference, {
      customTitle: props.abstractType,
    });
    downloadBlob(blob, `${props.conference.toLowerCase()}_abstract.docx`);
  } catch (error) {
    console.error('DOCX export error:', error);
    exportError.value = t('errors.docx_export_failed');
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
