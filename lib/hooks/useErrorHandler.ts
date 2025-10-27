import { useCallback } from 'react';
import { AppError, ErrorCode, ErrorSeverity } from '../../types';
import { createAndLogError, errorLogger } from '../utils/errorLogger';
import { createAppError } from '../utils/retryUtils';

export interface UseErrorHandlerReturn {
  handleError: (error: any, context: string, severity?: ErrorSeverity) => string;
  logError: (error: AppError) => string;
  createError: (code: ErrorCode, message: string, context: string, severity?: ErrorSeverity) => AppError;
  getErrorStats: () => ReturnType<typeof errorLogger.getErrorStats>;
  clearLogs: () => void;
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const handleError = useCallback((
    error: any, 
    context: string, 
    severity: ErrorSeverity = 'medium'
  ): string => {
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
  }, []);

  const logError = useCallback((error: AppError): string => {
    return errorLogger.logError(error);
  }, []);

  const createError = useCallback((
    code: ErrorCode,
    message: string,
    context: string,
    severity: ErrorSeverity = 'medium'
  ): AppError => {
    return {
      code,
      message,
      details: undefined,
      recoverable: code !== 'UNKNOWN_ERROR',
      timestamp: new Date(),
      severity,
      context
    };
  }, []);

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
    clearLogs
  };
}

// Utility hook for handling async operations with error logging
export function useAsyncErrorHandler() {
  const { handleError } = useErrorHandler();

  const executeWithErrorHandling = useCallback(async <T>(
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
  }, [handleError]);

  return { executeWithErrorHandling };
}