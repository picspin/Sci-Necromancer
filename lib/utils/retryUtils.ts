import { RetryConfig, AppError } from '../../types';

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
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
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // 如果错误类型本身声明不允许重试，直接抛出
      if (err instanceof RetryableError && !err.retryable) {
        throw err;
      }

      // 已到最后一次尝试就停止循环
      if (attempt === finalConfig.maxAttempts) {
        break;
      }

      // 是否继续重试（你也可以加一个 shouldRetry(lastError) 判断）
      const delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.backoffFactor, attempt - 1),
        finalConfig.maxDelay
      );
      const jitteredDelay = delay + Math.random() * 1000;

      console.warn(
        `Retry attempt ${attempt}/${finalConfig.maxAttempts} for ${context || 'operation'} in ${Math.round(jitteredDelay)}ms`,
        {
          error: err.message,
          attempt,
          delay: Math.round(jitteredDelay)
        }
      );

      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }

  // 循环退出：所有尝试失败
  if (!lastError) {
    // 理论上不会发生（因为只有 catch 才会 break 到这里），但为类型与健壮性做保护
    throw new Error(
      `Operation failed after ${finalConfig.maxAttempts} attempts without capturing an Error (context=${context || 'operation'})`
    );
  }

  throw new RetryableError(
    `Operation failed after ${finalConfig.maxAttempts} attempts: ${lastError.message}`,
    lastError
  );
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  const code = (error.code || '').toLowerCase();
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
  const message = (error.message || '').toLowerCase();
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
