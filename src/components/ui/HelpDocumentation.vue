<template>
  <div class="fixed bottom-4 right-4 z-40">
    <div
      class="rounded-lg shadow-xl bg-base-200 border border-base-300 transition-all duration-300 overflow-hidden"
      :style="{ width: containerWidth + 'px', maxHeight: '70vh' }"
      role="dialog"
      aria-label="网站使用与配置提示（中文）"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-3 border-b border-base-300">
        <div class="flex items-center gap-2">
          <SvgIcon type="document" class="h-5 w-5 text-brand-primary" />
          <h2 class="text-sm font-semibold text-text-primary">网站使用与配置提示（中文）</h2>
        </div>
        <button
          @click="emit('close')"
          class="text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-md p-1"
          aria-label="关闭帮助"
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
          aria-label="帮助目录"
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

const helpSections: HelpSection[] = [
  {
    id: '1',
    title: '如何分析上传文件并生成不同格式论文（ISMRM、RSNA、ER、ESC 等）',
    content: `步骤与说明：
• 在首页选择目标会议（ISMRM、RSNA、ER、ESC 等）。
• 选择分析模式：标准模式（已有论文）或创意扩展模式（一句话想法）。
• 上传 PDF 或 DOCX 文件，或直接粘贴论文文本。
• 点击"分析"，系统自动提取类别与关键词；可在弹窗中筛选、调整。
• 选择建议的摘要类型（标准/注册/临床实践/ISMRT 等），再点击"生成"。
• 系统会根据选定会议规范自动排版输出，可在导出面板下载为不同格式。

技巧：
• 文件较大时处理耗时更长，耐心等待即可；若上传失败，可尝试直接粘贴文本。
• 分类概率匹配基于内容，支持多类别与关键词，可根据投稿策略进行微调。`,
  },
  {
    id: '2',
    title: '如何配置模型',
    content: `概述：
• 本系统支持 Google AI (Gemini) 与 OpenAI API 兼容提供商（如 OpenAI 官方、SiliconFlow 等）。
• 可在「模型配置」面板选择提供商并填写密钥与模型。
• 点击右上角的「模型配置」按钮打开配置面板。`,
  },
  {
    id: '2.1',
    title: 'Google AI 模型配置指南',
    content: `配置步骤：
• 在「模型配置」面板中选择 Google AI 提供商。
• 在 API Key 输入框填入 Google AI 的密钥，将安全保存在本地。
• 选择文本模型（如 gemini-2.5-flash）和图像模型（如 imagen-3.0）。
• 保存设置后即可使用。

建议：
• 若需更强大的风格统一与结构化输出，建议使用 gemini-2.5-pro。
• 网络较慢时，可稍等片刻重试。`,
  },
  {
    id: '2.2',
    title: 'OpenAI API 兼容模型配置指南',
    content: `步骤：
• 在「模型配置」中选择 OpenAI Compatible 提供商。
• 填写 Base URL（如 https://api.openai.com/v1 或第三方供应商地址）与 API Key。
• 点击每个模型下拉框旁边的刷新按钮拉取可用模型列表。
• 在「文本模型/视觉模型/图像模型」下拉框中选择合适的模型。

注意与建议：
• 不同供应商的模型 ID 可能不同，请以实际返回列表为准。
• 图像生成支持 SiliconFlow 等兼容 /v1/images/generations 的服务商。`,
  },
  {
    id: '2.3',
    title: '图像生成模型特殊配置与选择说明',
    content: `说明：
• 标准模式：上传已有图像，填写规格说明，点击「生成图像」进行处理。
• 创意模式：先生成摘要，再在图像页选择「创意模式」，系统将根据摘要自动生成配图。
• OpenAI 兼容路径支持图像生成与视觉分析。
• Google 路径支持 Imagen 图像生成。

MCP 工具配置：
• 可在 MCP Tools 选项卡中启用图像生成工具。
• 配置 Base URL、Model 与可选的自定义配置（JSON 格式）。`,
  },
  {
    id: '2.4',
    title: 'MCP 配置说明',
    content: `MCP (Model Context Protocol) 工具配置：
• 在「模型配置」→「MCP Tools」选项卡中启用对应工具。
• Supabase 数据库：启用后可进行云端存储与同步（可选功能）。
• 图像生成 MCP：配置独立的图像生成端点和模型。

配置项说明：
• Base URL：MCP 服务端点地址
• Model：具有工具调用权限的模型
• Custom Configuration：自定义 JSON 配置（如自定义请求头）`,
  },
  {
    id: '3',
    title: '文章摘要存储、读取与数据库及 Supabase MCP 功能说明',
    content: `说明：
• 本地存储：摘要会自动保存到浏览器 LocalStorage，关闭页面后数据仍然保留。
• 云端同步（可选）：启用 Supabase 后可跨设备同步摘要数据。
• 摘要管理器：点击右上角「摘要库」按钮，可查看、加载、删除已保存的摘要。
• 支持将摘要导出为 JSON 格式进行备份。`,
  },
  {
    id: '4',
    title: '文章与图像导出功能与支持格式',
    content: `支持的导出格式：
• MD (Markdown)：纯文本格式，方便编辑和版本控制
• PDF：标准文档格式，适合打印和正式提交
• JSON：结构化数据格式，便于数据迁移和备份

图像导出：
• 生成的图像可直接下载保存
• 支持常见图片格式

使用方法：
• 在生成输出面板右上角点击对应格式按钮即可导出
• 导出前请确保内容已生成完成`,
  },
];

const selectedSection = ref<string | null>(null);
const expandedSections = ref<Set<string>>(new Set());
const hoverTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

// Get top-level sections (no dot in id)
const topLevelSections = computed(() => helpSections.filter((s) => !s.id.includes('.')));

// Get sub-sections for a parent
const getSubSections = (parentId: string) =>
  helpSections.filter((s) => s.id.startsWith(parentId + '.'));

const currentSection = computed(() =>
  selectedSection.value ? helpSections.find((s) => s.id === selectedSection.value) || null : null
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
