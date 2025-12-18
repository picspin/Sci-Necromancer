import { ref } from 'vue';

export function useLiveRegion() {
  const announcement = ref('');
  const priority = ref<'polite' | 'assertive'>('polite');

  const announce = (message: string, announcePriority: 'polite' | 'assertive' = 'polite') => {
    priority.value = announcePriority;
    announcement.value = message;
  };

  const clear = () => {
    announcement.value = '';
  };

  return {
    announcement,
    priority,
    announce,
    clear,
  };
}
