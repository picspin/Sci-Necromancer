<template>
  <div class="relative">
    <button
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
      :title="t('header.language_toggle')"
      :aria-label="t('header.language_toggle')"
      :aria-expanded="isOpen"
      aria-haspopup="true"
    >
      <SvgIcon type="language" class="h-5 w-5" />
      <span class="hidden sm:inline flex items-center gap-1">
        <span>{{ currentLang.flag }}</span>
        <span>{{ currentLang.code.toUpperCase() }}</span>
      </span>
    </button>

    <!-- Backdrop -->
    <div v-if="isOpen" class="fixed inset-0 z-40" @click="isOpen = false" aria-hidden="true" />

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-40 bg-base-200 border border-base-300 rounded-md shadow-lg py-1 z-50"
      >
        <button
          v-for="language in languages"
          :key="language.code"
          @click="handleLanguageChange(language.code)"
          :class="[
            'block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-base-300 flex items-center gap-2',
            currentLanguage === language.code
              ? 'text-brand-primary bg-brand-primary/10'
              : 'text-text-primary',
          ]"
          role="menuitem"
        >
          <span>{{ language.flag }}</span>
          <span>{{ language.name }}</span>
          <SvgIcon v-if="currentLanguage === language.code" type="check" class="h-4 w-4 ml-auto" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import SvgIcon from '@/components/ui/SvgIcon.vue';

const { t, locale } = useI18n();
const isOpen = ref(false);

const currentLanguage = computed(() => locale.value || 'en');

const languages = computed(() => [
  { code: 'en', name: t('common.english'), flag: '🇺🇸' },
  { code: 'zh', name: t('common.chinese'), flag: '🇨🇳' },
]);

const currentLang = computed(() => {
  return languages.value.find((lang) => lang.code === currentLanguage.value) || languages.value[0];
});

const handleLanguageChange = (languageCode: string) => {
  locale.value = languageCode;
  localStorage.setItem('i18nextLng', languageCode);
  isOpen.value = false;
};
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
