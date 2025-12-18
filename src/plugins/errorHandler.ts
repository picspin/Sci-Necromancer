import type { ComponentPublicInstance } from 'vue';
import type { AppError } from '@/types';

/**
 * Global Vue error handler
 * Catches and processes all Vue component errors
 */
export function errorHandler(
  err: unknown,
  instance: ComponentPublicInstance | null,
  info: string
): void {
  // Build structured error
  const appError: AppError = {
    code: err instanceof Error ? err.name : 'UNKNOWN_ERROR',
    message: err instanceof Error ? err.message : String(err),
    details: {
      componentName: instance?.$options.name || 'Unknown',
      lifecycle: info,
      stack: err instanceof Error ? err.stack : undefined,
    },
    recoverable: true,
    timestamp: new Date(),
    severity: 'high',
    context: `Vue Error Handler: ${info}`,
  };

  // Log to console (in development)
  if (import.meta.env.DEV) {
    console.error('[Vue Error Handler]', {
      error: appError,
      originalError: err,
      instance,
      info,
    });
  }

  // Send to error reporting service (if configured)
  // Example: Sentry, LogRocket, etc.
  if (import.meta.env.PROD) {
    // sendToErrorReporting(appError);
  }

  // Show user-friendly notification
  // This will be handled by the notification system
  if (typeof window !== 'undefined' && (window as any).notificationService) {
    (window as any).notificationService.error(`An error occurred: ${appError.message}`, 5000);
  }
}

/**
 * Handle uncaught promise rejections
 */
export function setupGlobalErrorHandlers(): void {
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      const appError: AppError = {
        code: 'UNHANDLED_PROMISE_REJECTION',
        message: event.reason?.message || String(event.reason),
        details: event.reason,
        recoverable: false,
        timestamp: new Date(),
        severity: 'critical',
        context: 'Global Promise Rejection Handler',
      };

      console.error('[Unhandled Promise Rejection]', appError);

      if (typeof window !== 'undefined' && (window as any).notificationService) {
        (window as any).notificationService.error(
          'An unexpected error occurred. Please try again.',
          5000
        );
      }

      event.preventDefault();
    });

    window.addEventListener('error', (event) => {
      const appError: AppError = {
        code: 'GLOBAL_ERROR',
        message: event.message,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        recoverable: false,
        timestamp: new Date(),
        severity: 'critical',
        context: 'Global Error Handler',
      };

      console.error('[Global Error]', appError);

      event.preventDefault();
    });
  }
}
