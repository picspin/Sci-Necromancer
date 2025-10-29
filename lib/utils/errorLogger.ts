import { AppError, ErrorCode, ErrorSeverity } from '../../types';

export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  context: string;
  userAgent: string;
  url: string;
  sessionId: string;
  // Privacy-safe metadata only
  metadata?: {
    fileType?: string;
    provider?: string;
    operation?: string;
    retryCount?: number;
  };
}

export interface ErrorStats {
  totalErrors: number;
  errorsByCode: Record<ErrorCode, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: ErrorLogEntry[];
  topErrors: Array<{ code: ErrorCode; count: number; lastOccurred: Date }>;
}

export interface UserFeedback {
  errorId: string;
  rating: 'helpful' | 'not-helpful';
  comment?: string;
  timestamp: Date;
}

class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private feedback: UserFeedback[] = [];
  private sessionId: string;
  private maxLogEntries: number = 100;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadStoredLogs();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeMessage(message: string): string {
    // Remove potential PII from error messages
    return message
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b\d{10,}\b/g, '[NUMBER]')
      .replace(/['"]/g, '') // Remove quotes that might contain sensitive data
      .substring(0, 500); // Limit message length
  }

  private sanitizeContext(context: string): string {
    // Keep only safe context information
    const safeContexts = [
      'Content Analysis', 'Abstract Generation', 'File Processing',
      'Export Service', 'Database Service', 'Component Error',
      'Service Error', 'Network Error', 'Validation Error'
    ];
    
    return safeContexts.find(safe => context.includes(safe)) || 'Unknown Context';
  }

  logError(error: AppError): string {
    // Normalize code to valid ErrorCode
    const normalizedCode: ErrorCode = 
      (error.code === 'UNKNOWN_ERROR' || 
       error.code === 'NETWORK_ERROR' || 
       error.code === 'API_ERROR' || 
       error.code === 'FILE_PROCESSING_ERROR' || 
       error.code === 'VALIDATION_ERROR') 
        ? error.code 
        : 'UNKNOWN_ERROR';
    
    const logEntry: ErrorLogEntry = {
      id: this.generateLogId(),
      timestamp: error.timestamp,
      code: normalizedCode,
      message: this.sanitizeMessage(error.message),
      severity: error.severity || 'medium',
      context: this.sanitizeContext(error.context || 'Unknown'),
      userAgent: navigator.userAgent.substring(0, 200), // Limit length
      url: window.location.pathname, // Don't include query params
      sessionId: this.sessionId,
      metadata: this.extractSafeMetadata(error)
    };

    this.logs.push(logEntry);
    this.trimLogs();
    this.storeLogs();

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', {
        id: logEntry.id,
        code: logEntry.code,
        message: logEntry.message,
        context: logEntry.context
      });
    }

    return logEntry.id;
  }

  private generateLogId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private extractSafeMetadata(error: AppError): ErrorLogEntry['metadata'] {
    const metadata: ErrorLogEntry['metadata'] = {};

    // Extract safe metadata from error details
    if (error.details && typeof error.details === 'object') {
      // File type information (safe)
      if (error.details.fileType) {
        metadata.fileType = String(error.details.fileType).toLowerCase();
      }
      
      // Provider information (safe)
      if (error.details.provider) {
        metadata.provider = String(error.details.provider).toLowerCase();
      }
      
      // Operation type (safe)
      if (error.details.operation) {
        metadata.operation = String(error.details.operation).toLowerCase();
      }
      
      // Retry count (safe)
      if (typeof error.details.retryCount === 'number') {
        metadata.retryCount = error.details.retryCount;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private trimLogs(): void {
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }
  }

  private storeLogs(): void {
    try {
      const logsToStore = this.logs.slice(-50); // Store only recent logs
      localStorage.setItem('error-logs', JSON.stringify(logsToStore));
    } catch (error) {
      console.warn('Failed to store error logs:', error);
    }
  }

  private loadStoredLogs(): void {
    try {
      const stored = localStorage.getItem('error-logs');
      if (stored) {
        const logs = JSON.parse(stored);
        this.logs = logs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load stored error logs:', error);
      this.logs = [];
    }
  }

  getErrorStats(): ErrorStats {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentErrors = this.logs.filter(log => log.timestamp >= oneDayAgo);
    
    const errorsByCode = this.logs.reduce((acc, log) => {
      acc[log.code] = (acc[log.code] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCode, number>);
    
    const errorsBySeverity = this.logs.reduce((acc, log) => {
      acc[log.severity] = (acc[log.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);
    
    const topErrors = Object.entries(errorsByCode)
      .map(([code, count]) => ({
        code: code as ErrorCode,
        count,
        lastOccurred: this.logs
          .filter(log => log.code === code)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp || new Date()
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalErrors: this.logs.length,
      errorsByCode,
      errorsBySeverity,
      recentErrors: recentErrors.slice(-10),
      topErrors
    };
  }

  collectUserFeedback(errorId: string, rating: 'helpful' | 'not-helpful', comment?: string): void {
    const feedback: UserFeedback = {
      errorId,
      rating,
      comment: comment ? this.sanitizeMessage(comment) : undefined,
      timestamp: new Date()
    };

    this.feedback.push(feedback);
    this.storeFeedback();
  }

  private storeFeedback(): void {
    try {
      localStorage.setItem('error-feedback', JSON.stringify(this.feedback.slice(-20)));
    } catch (error) {
      console.warn('Failed to store error feedback:', error);
    }
  }

  getErrorById(id: string): ErrorLogEntry | undefined {
    return this.logs.find(log => log.id === id);
  }

  clearLogs(): void {
    this.logs = [];
    this.feedback = [];
    localStorage.removeItem('error-logs');
    localStorage.removeItem('error-feedback');
  }

  // Export logs for debugging (privacy-safe)
  exportLogs(): string {
    const exportData = {
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      stats: this.getErrorStats(),
      logs: this.logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        code: log.code,
        message: log.message,
        severity: log.severity,
        context: log.context,
        metadata: log.metadata
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Monitor error patterns
  detectErrorPatterns(): Array<{ pattern: string; frequency: number; suggestion: string }> {
    const patterns: Array<{ pattern: string; frequency: number; suggestion: string }> = [];
    
    const stats = this.getErrorStats();
    
    // Check for high network error frequency
    const networkErrors = stats.errorsByCode['NETWORK_ERROR'] || 0;
    if (networkErrors > 5) {
      patterns.push({
        pattern: 'Frequent network errors',
        frequency: networkErrors,
        suggestion: 'Check internet connection or try switching to offline mode'
      });
    }
    
    // Check for API errors
    const apiErrors = stats.errorsByCode['API_ERROR'] || 0;
    if (apiErrors > 3) {
      patterns.push({
        pattern: 'Repeated API failures',
        frequency: apiErrors,
        suggestion: 'Try switching AI providers or check API key configuration'
      });
    }
    
    // Check for file processing errors
    const fileErrors = stats.errorsByCode['FILE_PROCESSING_ERROR'] || 0;
    if (fileErrors > 2) {
      patterns.push({
        pattern: 'File processing issues',
        frequency: fileErrors,
        suggestion: 'Try converting files to a different format or use manual text input'
      });
    }

    return patterns;
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Utility function to log errors from anywhere in the app
export function logError(error: AppError): string {
  return errorLogger.logError(error);
}

// Utility function to create and log an error
export function createAndLogError(
  code: ErrorCode,
  message: string,
  context: string,
  severity: ErrorSeverity = 'medium',
  details?: any
): string {
  const appError: AppError = {
    code,
    message,
    details,
    recoverable: code !== 'UNKNOWN_ERROR',
    timestamp: new Date(),
    severity,
    context
  };
  
  return errorLogger.logError(appError);
}
