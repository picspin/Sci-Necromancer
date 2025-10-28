/**
 * Accessibility utilities for managing focus, ARIA attributes, and keyboard navigation
 */

/**
 * Trap focus within a container element (useful for modals and dialogs)
 */
export const trapFocus = (container: HTMLElement): (() => void) => {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTabKey);

  // Focus first element
  firstFocusable?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
};

/**
 * Restore focus to a previously focused element
 */
export const createFocusManager = () => {
  let previouslyFocused: HTMLElement | null = null;

  return {
    saveFocus: () => {
      previouslyFocused = document.activeElement as HTMLElement;
    },
    restoreFocus: () => {
      previouslyFocused?.focus();
      previouslyFocused = null;
    },
  };
};

/**
 * Announce message to screen readers using ARIA live region
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Generate unique ID for ARIA relationships
 */
let idCounter = 0;
export const generateId = (prefix: string = 'a11y'): string => {
  idCounter++;
  return `${prefix}-${idCounter}-${Date.now()}`;
};

/**
 * Check if element is visible and focusable
 */
export const isFocusable = (element: HTMLElement): boolean => {
  if (element.tabIndex < 0) return false;
  if (element.hasAttribute('disabled')) return false;
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  
  return true;
};

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const elements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  return Array.from(elements).filter(isFocusable);
};

/**
 * Handle keyboard navigation for lists and grids
 */
export const handleArrowNavigation = (
  e: KeyboardEvent,
  elements: HTMLElement[],
  currentIndex: number,
  orientation: 'horizontal' | 'vertical' | 'both' = 'both'
): number => {
  let newIndex = currentIndex;

  switch (e.key) {
    case 'ArrowDown':
      if (orientation === 'vertical' || orientation === 'both') {
        e.preventDefault();
        newIndex = Math.min(currentIndex + 1, elements.length - 1);
      }
      break;
    case 'ArrowUp':
      if (orientation === 'vertical' || orientation === 'both') {
        e.preventDefault();
        newIndex = Math.max(currentIndex - 1, 0);
      }
      break;
    case 'ArrowRight':
      if (orientation === 'horizontal' || orientation === 'both') {
        e.preventDefault();
        newIndex = Math.min(currentIndex + 1, elements.length - 1);
      }
      break;
    case 'ArrowLeft':
      if (orientation === 'horizontal' || orientation === 'both') {
        e.preventDefault();
        newIndex = Math.max(currentIndex - 1, 0);
      }
      break;
    case 'Home':
      e.preventDefault();
      newIndex = 0;
      break;
    case 'End':
      e.preventDefault();
      newIndex = elements.length - 1;
      break;
  }

  if (newIndex !== currentIndex) {
    elements[newIndex]?.focus();
  }

  return newIndex;
};

/**
 * Create a skip link for keyboard navigation
 */
export const createSkipLink = (targetId: string, label: string = 'Skip to main content'): HTMLAnchorElement => {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = label;
  skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-md';
  
  return skipLink;
};
