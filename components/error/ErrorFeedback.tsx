import React, { useState } from 'react';
import { errorLogger } from '../../lib/utils/errorLogger';

interface ErrorFeedbackProps {
  errorId: string;
  onClose?: () => void;
  compact?: boolean;
}

export const ErrorFeedback: React.FC<ErrorFeedbackProps> = ({ 
  errorId, 
  onClose, 
  compact = false 
}) => {
  const [rating, setRating] = useState<'helpful' | 'not-helpful' | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (rating) {
      errorLogger.collectUserFeedback(errorId, rating, comment.trim() || undefined);
      setSubmitted(true);
      
      // Auto-close after submission
      setTimeout(() => {
        onClose?.();
      }, 2000);
    }
  };

  if (submitted) {
    return (
      <div className={`${compact ? 'p-2' : 'p-3'} bg-green-50 border border-green-200 rounded text-sm`}>
        <div className="flex items-center text-green-700">
          <span className="mr-2">✓</span>
          <span>Thank you for your feedback!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'p-2' : 'p-3'} bg-gray-50 border border-gray-200 rounded`}>
      <div className="text-sm text-gray-700 mb-2">
        Was this error message helpful?
      </div>
      
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setRating('helpful')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            rating === 'helpful'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          👍 Helpful
        </button>
        <button
          onClick={() => setRating('not-helpful')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            rating === 'not-helpful'
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          👎 Not helpful
        </button>
      </div>
      
      {rating === 'not-helpful' && (
        <div className="mb-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What would make this error message more helpful? (optional)"
            className="w-full text-xs p-2 border border-gray-300 rounded resize-none"
            rows={2}
            maxLength={200}
          />
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">
          Error ID: {errorId.substring(0, 8)}...
        </div>
        <div className="flex gap-1">
          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!rating}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              rating
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

interface ErrorStatsDisplayProps {
  onClose?: () => void;
}

export const ErrorStatsDisplay: React.FC<ErrorStatsDisplayProps> = ({ onClose }) => {
  const [stats, setStats] = useState(errorLogger.getErrorStats());
  const [patterns, setPatterns] = useState(errorLogger.detectErrorPatterns());

  const refreshStats = () => {
    setStats(errorLogger.getErrorStats());
    setPatterns(errorLogger.detectErrorPatterns());
  };

  const exportLogs = () => {
    const logsData = errorLogger.exportLogs();
    const blob = new Blob([logsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    if (confirm('Are you sure you want to clear all error logs?')) {
      errorLogger.clearLogs();
      refreshStats();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Error Statistics</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-2xl font-bold text-gray-800">{stats.totalErrors}</div>
            <div className="text-sm text-gray-600">Total Errors</div>
          </div>
          <div className="bg-red-50 p-3 rounded">
            <div className="text-2xl font-bold text-red-600">
              {stats.errorsBySeverity.critical || 0}
            </div>
            <div className="text-sm text-gray-600">Critical</div>
          </div>
          <div className="bg-yellow-50 p-3 rounded">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.errorsBySeverity.high || 0}
            </div>
            <div className="text-sm text-gray-600">High</div>
          </div>
          <div className="bg-blue-50 p-3 rounded">
            <div className="text-2xl font-bold text-blue-600">
              {stats.recentErrors.length}
            </div>
            <div className="text-sm text-gray-600">Recent (24h)</div>
          </div>
        </div>

        {/* Error Patterns */}
        {patterns.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium mb-2">Detected Patterns</h4>
            <div className="space-y-2">
              {patterns.map((pattern, index) => (
                <div key={index} className="bg-orange-50 border border-orange-200 p-3 rounded">
                  <div className="font-medium text-orange-800">{pattern.pattern}</div>
                  <div className="text-sm text-orange-700">
                    Frequency: {pattern.frequency} | {pattern.suggestion}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Errors */}
        {stats.topErrors.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium mb-2">Most Common Errors</h4>
            <div className="space-y-2">
              {stats.topErrors.map((error, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-mono text-sm">{error.code}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{error.count} occurrences</div>
                    <div className="text-xs text-gray-500">
                      Last: {error.lastOccurred.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <button
            onClick={refreshStats}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={exportLogs}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Export Logs
          </button>
          <button
            onClick={clearLogs}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Clear Logs
          </button>
        </div>
      </div>
    </div>
  );
};