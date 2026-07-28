<template>
  <div>
    <div v-if="siteKey" ref="container" class="min-h-16"></div>
    <p v-else class="text-xs text-amber-500">{{ t('membership.turnstile_unavailable') }}</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

declare global {
  interface Window {
    turnstile?: {
      render(element: HTMLElement, options: Record<string, unknown>): string;
      remove(widgetId: string): void;
    };
  }
}

const props = defineProps<{ siteKey: string }>();
const emit = defineEmits<{ token: [value: string] }>();
const { t } = useI18n();
const container = ref<HTMLElement | null>(null);
let widgetId: string | null = null;

function renderWidget() {
  if (!container.value || !window.turnstile || widgetId) return;
  widgetId = window.turnstile.render(container.value, {
    sitekey: props.siteKey,
    callback: (token: string) => emit('token', token),
    'expired-callback': () => emit('token', ''),
    'error-callback': () => emit('token', ''),
    theme: 'auto',
  });
}

onMounted(() => {
  if (!props.siteKey) return;
  const existing = document.querySelector<HTMLScriptElement>('script[data-sci-turnstile]');
  if (existing) {
    if (window.turnstile) renderWidget();
    else existing.addEventListener('load', renderWidget, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;
  script.dataset.sciTurnstile = 'true';
  script.addEventListener('load', renderWidget, { once: true });
  document.head.appendChild(script);
});

onBeforeUnmount(() => {
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
});
</script>
