<template>
  <div class="fixed bottom-4 right-4 z-40">
    <div
      class="rounded-lg shadow-xl bg-base-200 border border-base-300 transition-all duration-300 overflow-hidden"
      :style="{ width: containerWidth + 'px', maxHeight: '70vh' }"
      role="dialog"
      :aria-label="t('help.title')"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-3 border-b border-base-300">
        <div class="flex items-center gap-2">
          <SvgIcon type="document" class="h-5 w-5 text-brand-primary" />
          <h2 class="text-sm font-semibold text-text-primary">{{ t('help.title') }}</h2>
        </div>
        <button
          @click="emit('close')"
          class="text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-md p-1"
          :aria-label="t('help.close')"
          type="button"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex overflow-hidden" style="max-height: calc(70vh - 52px)">
        <!-- Left: Navigation with collapsible sections -->
        <div
          class="overflow-y-auto p-2 space-y-1 border-r border-base-300 transition-all duration-300"
          :style="{ width: navWidth + 'px' }"
          role="navigation"
          :aria-label="t('help.navigation')"
        >
          <template v-for="section in topLevelSections" :key="section.id">
            <!-- Top level section -->
            <div
              @mouseenter="handleSectionHover(section.id)"
              @mouseleave="handleSectionLeave(section.id)"
            >
              <button
                @click="toggleSection(section.id)"
                :class="[
                  'w-full text-left p-2.5 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary flex items-center gap-2',
                  selectedSection === section.id || expandedSections.has(section.id)
                    ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                    : 'bg-base-100 hover:bg-base-300/50 border-base-300 text-text-primary',
                ]"
                :aria-expanded="expandedSections.has(section.id)"
              >
                <component :is="getSectionIcon(section.id)" class="w-4 h-4 opacity-70 shrink-0" />
                <span class="text-xs flex-1">{{ section.id }}. {{ section.title }}</span>
                <svg
                  v-if="getSubSections(section.id).length > 0"
                  :class="[
                    'w-3 h-3 transition-transform',
                    expandedSections.has(section.id) ? 'rotate-180' : '',
                  ]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <!-- Sub-sections (expandable) -->
              <div
                v-if="expandedSections.has(section.id) && getSubSections(section.id).length > 0"
                class="ml-4 mt-1 space-y-1"
              >
                <button
                  v-for="subSection in getSubSections(section.id)"
                  :key="subSection.id"
                  @click="selectSection(subSection.id)"
                  :class="[
                    'w-full text-left p-2 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary flex items-center gap-2',
                    selectedSection === subSection.id
                      ? 'bg-brand-primary/10 border-brand-primary/50 text-brand-primary'
                      : 'bg-base-100/50 hover:bg-base-300/30 border-base-300/50 text-text-secondary',
                  ]"
                >
                  <span class="text-xs">{{ subSection.id }}. {{ subSection.title }}</span>
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- Right: Content (only shown when section selected and expanded) -->
        <div
          v-if="showContent"
          class="flex-1 overflow-y-auto p-3 transition-all duration-300"
          :style="{ width: contentWidth + 'px' }"
        >
          <div v-if="currentSection">
            <h3 class="text-sm font-semibold text-text-primary mb-2 pb-2 border-b border-base-300">
              {{ currentSection.id }}. {{ currentSection.title }}
            </h3>
            <div class="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
              {{ currentSection.content }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import SvgIcon from './SvgIcon.vue';

interface Props {
  isOpen: boolean;
}

defineProps<Props>();

const emit = defineEmits<{ close: [] }>();

interface HelpSection {
  id: string;
  title: string;
  content: string;
}

const { t } = useI18n();
const sectionDefs = [
  { id: '1', key: 's1' },
  { id: '2', key: 's2' },
  { id: '2.1', key: 's21' },
  { id: '2.2', key: 's22' },
  { id: '2.3', key: 's23' },
  { id: '2.4', key: 's24' },
  { id: '3', key: 's3' },
  { id: '4', key: 's4' },
] as const;
const helpSections = computed<HelpSection[]>(() =>
  sectionDefs.map(({ id, key }) => ({
    id,
    title: t(`help.sections.${key}.title`),
    content: t(`help.sections.${key}.content`),
  }))
);

const selectedSection = ref<string | null>(null);
const expandedSections = ref<Set<string>>(new Set());
const hoverTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

// Get top-level sections (no dot in id)
const topLevelSections = computed(() => helpSections.value.filter((s) => !s.id.includes('.')));

// Get sub-sections for a parent
const getSubSections = (parentId: string) =>
  helpSections.value.filter((s) => s.id.startsWith(parentId + '.'));

const currentSection = computed(() =>
  selectedSection.value
    ? helpSections.value.find((s) => s.id === selectedSection.value) || null
    : null
);

// Show content panel when a section is selected
const showContent = computed(() => selectedSection.value !== null);

// Dynamic widths based on state
const navWidth = computed(() => (showContent.value ? 320 : 340));
const contentWidth = computed(() => 340);
const containerWidth = computed(() =>
  showContent.value ? navWidth.value + contentWidth.value : navWidth.value
);

const handleSectionHover = (sectionId: string) => {
  // Clear any existing timeout
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value);
  }

  // Expand after a short delay
  hoverTimeout.value = setTimeout(() => {
    expandedSections.value.add(sectionId);
    // Auto-select if no sub-sections
    if (getSubSections(sectionId).length === 0) {
      selectedSection.value = sectionId;
    }
  }, 150);
};

const handleSectionLeave = (sectionId: string) => {
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value);
  }
  // Don't collapse if this section or its children are selected
  if (selectedSection.value === sectionId || selectedSection.value?.startsWith(sectionId + '.')) {
    return;
  }
  // Collapse after delay
  hoverTimeout.value = setTimeout(() => {
    expandedSections.value.delete(sectionId);
  }, 300);
};

const toggleSection = (sectionId: string) => {
  if (expandedSections.value.has(sectionId)) {
    // If has sub-sections, collapse
    if (getSubSections(sectionId).length > 0) {
      expandedSections.value.delete(sectionId);
      // Clear selection if child was selected
      if (selectedSection.value?.startsWith(sectionId + '.')) {
        selectedSection.value = null;
      }
    }
  } else {
    expandedSections.value.add(sectionId);
  }
  // Select this section if no sub-sections
  if (getSubSections(sectionId).length === 0) {
    selectedSection.value = sectionId;
  } else {
    selectedSection.value = sectionId;
  }
};

const selectSection = (sectionId: string) => {
  selectedSection.value = sectionId;
  // Ensure parent is expanded
  const parentId = sectionId.split('.')[0];
  expandedSections.value.add(parentId);
};

// Get icon for section based on ID
const getSectionIcon = (id: string) => {
  const icons: Record<string, any> = {
    '1': () =>
      h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        }),
      ]),
    '2': () =>
      h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
        }),
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
        }),
      ]),
    '3': () =>
      h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
        }),
      ]),
    '4': () =>
      h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
        }),
      ]),
  };

  const parentId = id.split('.')[0];
  return icons[parentId] || icons['1'];
};
</script>
