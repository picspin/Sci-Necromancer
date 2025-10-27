import { RetryConfig, AppError } from '../../types';

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2
};

export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly originalError: Error,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: string
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      if (error instanceof RetryableError && !error.retryable) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === finalConfig.maxAttempts) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.backoffFactor, attempt - 1),
        finalConfig.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000;
      
      console.warn(`Retry attempt ${attempt}/${finalConfig.maxAttempts} for ${context || 'operation'} in ${Math.round(jitteredDelay)}ms`, {
        error: error instanceof Error ? error.message : String(error),
        attempt,
        delay: Math.round(jitteredDelay)
      });
      
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }
  
  // All retries failed, throw the last error
  throw new RetryableError(
    `Operation failed after ${finalConfig.maxAttempts} attempts: ${lastError.message}`,
    lastError
  );
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';
  
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    code === 'network_error' ||
    code === 'enotfound' ||
    code === 'econnreset' ||
    code === 'etimedout'
  );
}

export function isRateLimitError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const status = error.status || error.statusCode;
  
  return (
    status === 429 ||
    message.includes('rate limit') ||
    message.includes('quota exceeded') ||
    message.includes('too many requests')
  );
}

export function shouldRetry(error: any): boolean {
  return isNetworkError(error) || isRateLimitError(error);
}

export function createAppError(error: any, context: string): AppError {
  let code: AppError['code'] = 'UNKNOWN_ERROR';
  let severity: AppError['severity'] = 'medium';
  
  if (isNetworkError(error)) {
    code = 'NETWORK_ERROR';
    severity = 'high';
  } else if (isRateLimitError(error)) {
    code = 'API_ERROR';
    severity = 'medium';
  } else if (error.message?.includes('file') || error.message?.includes('parse')) {
    code = 'FILE_PROCESSING_ERROR';
    severity = 'medium';
  } else if (error.message?.includes('validation')) {
    code = 'VALIDATION_ERROR';
    severity = 'low';
  }
  
  return {
    code,
    message: error.message || 'An unexpected error occurred',
    details: error.stack || error,
    recoverable: shouldRetry(error),
    timestamp: new Date(),
    severity,
    context
  };
}