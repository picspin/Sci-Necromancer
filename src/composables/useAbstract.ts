import { ref, computed } from 'vue';
import type { SavedAbstract } from '@/types';

// Reactive abstract state
const abstractToLoad = ref<SavedAbstract | null>(null);

export function useAbstract() {
  const loadAbstract = (abstract: SavedAbstract): void => {
    abstractToLoad.value = abstract;
  };

  const clearLoadedAbstract = (): void => {
    abstractToLoad.value = null;
  };

  return {
    abstractToLoad: computed(() => abstractToLoad.value),
    loadAbstract,
    clearLoadedAbstract,
  };
}
