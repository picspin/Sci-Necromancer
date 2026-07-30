<template>
  <a
    :href="PROJECT_REPOSITORY_URL"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-2 text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
    :aria-label="t('tooltips.github_repo')"
  >
    <SvgIcon type="github" class="h-5 w-5 shrink-0" />
    <span v-if="showLabel">{{ t('membership.support_on_github') }}</span>
  </a>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import { PROJECT_REPOSITORY_URL } from '@/src/constants/projectLinks';

withDefaults(defineProps<{ showLabel?: boolean }>(), { showLabel: true });
const { t } = useI18n();
</script>
