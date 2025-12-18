import { ref, onMounted, onUnmounted } from 'vue';
import { notificationService, type Notification } from '@/lib/utils/notificationService';

export function useNotifications() {
  const notifications = ref<Notification[]>([]);
  let unsubscribe: (() => void) | null = null;

  onMounted(() => {
    // Subscribe to notification service
    unsubscribe = notificationService.subscribe((notification: Notification) => {
      notifications.value = [...notifications.value, notification];
    });
  });

  onUnmounted(() => {
    // Cleanup subscription
    if (unsubscribe) {
      unsubscribe();
    }
  });

  const removeNotification = (id: string) => {
    notifications.value = notifications.value.filter((n) => n.id !== id);
    notificationService.remove(id);
  };

  // Expose notification service methods for convenience
  const success = (message: string, duration?: number) => {
    notificationService.success(message, duration);
  };

  const error = (message: string, duration?: number) => {
    notificationService.error(message, duration);
  };

  const warning = (message: string, duration?: number) => {
    notificationService.warning(message, duration);
  };

  const info = (message: string, duration?: number) => {
    notificationService.info(message, duration);
  };

  return {
    notifications,
    removeNotification,
    success,
    error,
    warning,
    info,
  };
}
