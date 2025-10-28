import React, { useState } from 'react';

interface ContextualHelpProps {
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Contextual help component that displays help text in a popover
 */
const ContextualHelp: React.FC<ContextualHelpProps> = ({
  title,
  content,
  position = 'top',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-brand-primary border-2 border-brand-primary rounded-full hover:bg-brand-primary hover:text-white transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary"
        aria-label={`Help: ${title}`}
        aria-expanded={isOpen}
        type="button"
      >
        ?
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-64 p-4 bg-base-200 border-2 border-base-300 rounded-lg shadow-xl ${positionClasses[position]}`}
          role="tooltip"
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary rounded"
              aria-label="Close help"
              type="button"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-text-secondary">{content}</p>
        </div>
      )}
    </div>
  );
};

export default ContextualHelp;
