import { useCallback } from 'react';
import { AppError } from '../../types';
import { errorLogger } from '../utils/errorLogger';
import { createAppError } from '../utils/retryUtils';

export interface UseErrorHandlerReturn {
  handleError: (error: any, context: string, severity?: AppError['severity']) => string;
  logError: (error: AppError) => string;
  createError: (
    code: AppError['code'],
    message: string,
    context: string,
    severity?: AppError['severity']
  ) => AppError;
  getErrorStats: () => ReturnType<typeof errorLogger.getErrorStats>;
  clearLogs: () => void;
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const handleError = useCallback(
    (error: any, context: string, severity: AppError['severity'] = 'medium'): string => {
      let appError: AppError;

      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        // Already an AppError
        appError = error as AppError;
      } else {
        // Convert to AppError
        appError = createAppError(error, context);
        if (severity !== 'medium') {
          appError.severity = severity;
        }
      }

      return errorLogger.logError(appError);
    },
    []
  );

  const logError = useCallback((error: AppError): string => {
    return errorLogger.logError(error);
  }, []);

  const createError = useCallback(
    (
      code: AppError['code'],
      message: string,
      context: string,
      severity: AppError['severity'] = 'medium'
    ): AppError => {
      return {
        code,
        message,
        details: undefined,
        recoverable: code !== 'UNKNOWN_ERROR',
        timestamp: new Date(),
        severity,
        context,
      };
    },
    []
  );

  const getErrorStats = useCallback(() => {
    return errorLogger.getErrorStats();
  }, []);

  const clearLogs = useCallback(() => {
    errorLogger.clearLogs();
  }, []);

  return {
    handleError,
    logError,
    createError,
    getErrorStats,
    clearLogs,
  };
}

// Utility hook for handling async operations with error logging
export function useAsyncErrorHandler() {
  const { handleError } = useErrorHandler();

  const executeWithErrorHandling = useCallback(
    async <T>(
      operation: () => Promise<T>,
      context: string,
      onError?: (errorId: string) => void
    ): Promise<T | null> => {
      try {
        return await operation();
      } catch (error) {
        const errorId = handleError(error, context);
        onError?.(errorId);
        return null;
      }
    },
    [handleError]
  );

  return { executeWithErrorHandling };
}
