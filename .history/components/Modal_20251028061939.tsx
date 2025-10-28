import React, { ReactNode, useEffect, useRef } from 'react';
import { trapFocus, createFocusManager, generateId } from '../lib/utils/accessibilityUtils';

interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen = true, 
  onClose, 
  title, 
  children, 
  size = 'md',
  ariaLabel,
  ariaDescribedBy 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const focusManager = useRef(createFocusManager());
  const titleId = useRef(generateId('modal-title'));
  const descId = useRef(generateId('modal-desc'));

  useEffect(() => {
    if (!isOpen) return;

    // Save current focus
    focusManager.current.saveFocus();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Setup focus trap
    const cleanup = modalRef.current ? trapFocus(modalRef.current) : () => {};

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      cleanup();
      // Restore focus when modal closes
      focusManager.current.restoreFocus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in"
      role="presentation"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId.current : ariaLabel ? undefined : 'modal-dialog'}
        aria-describedby={ariaDescribedBy || descId.current}
        aria-label={!title ? ariaLabel : undefined}
        className={`bg-base-200 rounded-lg shadow-xl ${sizeClasses[size]} w-full max-h-[90vh] overflow-hidden animate-modal-show focus:outline-none focus:ring-3 focus:ring-brand-primary`}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-base-300">
            <h2 id={titleId.current} className="text-xl font-semibold text-text-primary">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary rounded-md p-1"
              aria-label="Close modal"
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div 
          id={descId.current}
          className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]"
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
