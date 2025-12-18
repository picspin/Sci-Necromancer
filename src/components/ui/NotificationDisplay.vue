<template>
  <Teleport to="body">
    <div v-if="notifications.length > 0" class="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <TransitionGroup name="notification">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="[
            'p-4 rounded-lg border shadow-lg transition-all duration-300',
            getNotificationStyles(notification.type),
          ]"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-2">
              <span class="text-lg font-semibold">
                {{ getNotificationIcon(notification.type) }}
              </span>
              <div class="flex-1">
                <h4 class="font-semibold text-sm">{{ notification.title }}</h4>
                <p class="text-sm mt-1">{{ notification.message }}</p>
              </div>
            </div>
            <button
              @click="removeNotification(notification.id)"
              class="ml-2 text-lg leading-none hover:opacity-70 transition-opacity"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useNotifications } from '@/composables/useNotifications';
import type { NotificationType } from '@/lib/utils/notificationService';

const { notifications, removeNotification } = useNotifications();

const getNotificationStyles = (type: NotificationType): string => {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-200 text-green-800';
    case 'error':
      return 'bg-red-50 border-red-200 text-red-800';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    case 'info':
    default:
      return 'bg-blue-50 border-blue-200 text-blue-800';
  }
};

const getNotificationIcon = (type: NotificationType): string => {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✗';
    case 'warning':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
};
</script>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}
</style>
