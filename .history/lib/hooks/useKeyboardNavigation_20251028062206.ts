import { useEffect, useCallback, RefObject } from 'react';

interface KeyboardNavigationOptions {
  onEscape?: () => void;
  onEnter?: () => void;
  onSpace?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onTab?: (shiftKey: boolean) => void;
  enabled?: boolean;
}

/**
 * Hook for handling keyboard navigation and shortcuts
 */
export const useKeyboardNavigation = (
  ref: RefObject<HTMLElement>,
  options: KeyboardNavigationOptions
) => {
  const {
    onEscape,
    onEnter,
    onSpace,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onHome,
    onEnd,
    onTab,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      switch (e.key) {
        case 'Escape':
          if (onEscape) {
            e.preventDefault();
            onEscape();
          }
          break;
        case 'Enter':
          if (onEnter) {
            e.preventDefault();
            onEnter();
          }
          break;
        case ' ':
          if (onSpace) {
            e.preventDefault();
            onSpace();
          }
          break;
        case 'ArrowUp':
          if (onArrowUp) {
            e.preventDefault();
            onArrowUp();
          }
          break;
        case 'ArrowDown':
          if (onArrowDown) {
            e.preventDefault();
            onArrowDown();
          }
          break;
        case 'ArrowLeft':
          if (onArrowLeft) {
            e.preventDefault();
            onArrowLeft();
          }
          break;
        case 'ArrowRight':
          if (onArrowRight) {
            e.preventDefault();
            onArrowRight();
          }
          break;
        case 'Home':
          if (onHome) {
            e.preventDefault();
            onHome();
          }
          break;
        case 'End':
          if (onEnd) {
            e.preventDefault();
            onEnd();
          }
          break;
        case 'Tab':
          if (onTab) {
            onTab(e.shiftKey);
          }
          break;
      }
    },
    [enabled, onEscape, onEnter, onSpace, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onHome, onEnd, onTab]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      element.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [ref, handleKeyDown]);
};

/**
 * Hook for managing focus within a list of items
 */
export const useListNavigation = (itemCount: number, initialIndex: number = 0) => {
  const [focusedIndex, setFocusedIndex] = React.useState(initialIndex);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, itemCount - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;
      }
    },
    [itemCount]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
  };
};

// Import React for useState
import React from 'react';
