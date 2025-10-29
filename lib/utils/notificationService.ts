export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // in milliseconds, undefined means persistent
  timestamp: Date;
}

class NotificationService {
  private listeners: ((notification: Notification) => void)[] = [];
  private notifications: Notification[] = [];

  subscribe(listener: (notification: Notification) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  notify(type: NotificationType, title: string, message: string, duration?: number): string {
    const notification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      duration,
      timestamp: new Date(),
    };

    this.notifications.push(notification);
    this.listeners.forEach(listener => listener(notification));

    // Auto-remove notification after duration
    if (duration) {
      setTimeout(() => {
        this.remove(notification.id);
      }, duration);
    }

    return notification.id;
  }

  success(title: string, message: string, duration = 5000): string {
    return this.notify('success', title, message, duration);
  }

  error(title: string, message: string, duration?: number): string {
    return this.notify('error', title, message, duration);
  }

  warning(title: string, message: string, duration = 7000): string {
    return this.notify('warning', title, message, duration);
  }

  info(title: string, message: string, duration = 5000): string {
    return this.notify('info', title, message, duration);
  }

  remove(id: string): void {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index > -1) {
      this.notifications.splice(index, 1);
    }
  }

  getAll(): Notification[] {
    return [...this.notifications];
  }

  clear(): void {
    this.notifications = [];
  }
}

export const notificationService = new NotificationService();