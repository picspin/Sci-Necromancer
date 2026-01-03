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
  const success = (title: string, message: string, duration?: number) => {
    notificationService.success(title, message, duration);
  };

  const error = (title: string, message: string, duration?: number) => {
    notificationService.error(title, message, duration);
  };

  const warning = (title: string, message: string, duration?: number) => {
    notificationService.warning(title, message, duration);
  };

  const info = (title: string, message: string, duration?: number) => {
    notificationService.info(title, message, duration);
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
