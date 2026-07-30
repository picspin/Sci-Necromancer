<template>
  <div
    class="flex h-full flex-col items-center justify-center text-text-secondary animate-fade-in"
    role="status"
    :aria-label="message"
  >
    <div class="science-loader" :data-scene="scene" aria-hidden="true">
      <div class="science-loader__orbital">
        <span class="science-loader__nucleus"></span>
        <i></i><i></i><i></i>
      </div>
      <div class="science-loader__dna">
        <i v-for="index in 6" :key="index"></i>
      </div>
      <div class="science-loader__cell"><i></i><i></i></div>
      <div class="science-loader__molecule"><i></i><i></i><i></i><i></i></div>
    </div>
    <p class="mt-4 text-base font-semibold text-text-primary" aria-live="polite">{{ message }}</p>
    <p class="mt-1 text-sm">{{ t('loading_messages.please_wait') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { resolveLoadingScene } from '@/src/services/loadingScene';

const props = withDefaults(defineProps<{ message?: string }>(), { message: '' });
const { t } = useI18n();
const scene = computed(() => resolveLoadingScene(props.message));
</script>

<style scoped>
.science-loader {
  position: relative;
  width: 5.5rem;
  height: 5.5rem;
  color: var(--color-brand-primary, #4a959f);
}
.science-loader > div {
  position: absolute;
  inset: 0;
  display: none;
}
.science-loader[data-scene='orbital'] .science-loader__orbital,
.science-loader[data-scene='dna'] .science-loader__dna,
.science-loader[data-scene='cell'] .science-loader__cell,
.science-loader[data-scene='molecule'] .science-loader__molecule {
  display: block;
}
.science-loader__nucleus {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  background: currentColor;
  box-shadow: 0 0 1rem currentColor;
  transform: translate(-50%, -50%);
}
.science-loader__orbital i {
  position: absolute;
  inset: 1.15rem 0.4rem;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  opacity: 0.72;
  animation: orbital-spin 1.8s linear infinite;
}
.science-loader__orbital i:nth-child(3) {
  transform: rotate(60deg);
  animation-direction: reverse;
}
.science-loader__orbital i:nth-child(4) {
  transform: rotate(120deg);
  animation-duration: 2.4s;
}
.science-loader__dna {
  padding: 0.4rem 1rem;
}
.science-loader__dna i {
  position: relative;
  display: block;
  width: 100%;
  height: 0.78rem;
}
.science-loader__dna i::before,
.science-loader__dna i::after {
  position: absolute;
  top: 0.2rem;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  content: '';
  background: currentColor;
  animation: dna-pulse 1.2s ease-in-out infinite alternate;
}
.science-loader__dna i::before {
  left: 0;
  box-shadow:
    0.55rem 0 0 -0.22rem currentColor,
    1.1rem 0 0 -0.22rem currentColor,
    1.65rem 0 0 -0.22rem currentColor,
    2.2rem 0 0 -0.22rem currentColor,
    2.75rem 0 0 -0.22rem currentColor;
}
.science-loader__dna i::after {
  right: 0;
  animation-direction: alternate-reverse;
}
.science-loader__dna i:nth-child(2n)::before,
.science-loader__dna i:nth-child(2n)::after {
  animation-delay: -0.6s;
}
.science-loader__cell i {
  position: absolute;
  top: 50%;
  width: 2.4rem;
  height: 2.4rem;
  border: 2px solid currentColor;
  border-radius: 42% 58% 54% 46%;
  background: color-mix(in srgb, currentColor 12%, transparent);
  transform: translateY(-50%);
  animation: cell-divide 1.8s ease-in-out infinite alternate;
}
.science-loader__cell i::after {
  position: absolute;
  inset: 0.72rem;
  border-radius: 50%;
  content: '';
  background: currentColor;
}
.science-loader__cell i:first-child {
  left: 0.55rem;
}
.science-loader__cell i:last-child {
  right: 0.55rem;
  animation-direction: alternate-reverse;
}
.science-loader__molecule i {
  position: absolute;
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-radius: 50%;
  background: var(--color-base-200, #1e293b);
  animation: molecule-breathe 1.4s ease-in-out infinite alternate;
}
.science-loader__molecule i::after {
  position: absolute;
  top: 0.35rem;
  left: 0.8rem;
  z-index: -1;
  width: 2.5rem;
  height: 2px;
  content: '';
  background: currentColor;
  transform-origin: left;
}
.science-loader__molecule i:nth-child(1) {
  top: 0.8rem;
  left: 0.7rem;
  transform: rotate(25deg);
}
.science-loader__molecule i:nth-child(2) {
  top: 2.15rem;
  right: 0.7rem;
  animation-delay: -0.35s;
  transform: rotate(135deg);
}
.science-loader__molecule i:nth-child(3) {
  bottom: 0.7rem;
  left: 1.15rem;
  animation-delay: -0.7s;
  transform: rotate(-55deg);
}
.science-loader__molecule i:nth-child(4) {
  top: 2.2rem;
  left: 2.25rem;
  animation-delay: -1.05s;
}
.science-loader__molecule i:nth-child(4)::after {
  display: none;
}
@keyframes orbital-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes dna-pulse {
  from {
    transform: translateX(0.65rem) scale(0.65);
    opacity: 0.45;
  }
  to {
    transform: translateX(-0.2rem) scale(1);
    opacity: 1;
  }
}
@keyframes cell-divide {
  from {
    transform: translate(0.55rem, -50%) rotate(-8deg) scale(0.86);
  }
  to {
    transform: translate(-0.35rem, -50%) rotate(8deg) scale(1);
  }
}
@keyframes molecule-breathe {
  to {
    filter: drop-shadow(0 0 0.5rem currentColor);
    transform: scale(1.18);
  }
}
@media (prefers-reduced-motion: reduce) {
  .science-loader *,
  .science-loader *::before,
  .science-loader *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
