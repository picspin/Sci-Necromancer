import React, { useEffect, useState } from 'react';

interface LiveRegionProps {
  message: string;
  priority?: 'polite' | 'assertive';
  clearAfter?: number;
}

/**
 * ARIA live region component for announcing dynamic content changes to screen readers
 */
const LiveRegion: React.FC<LiveRegionProps> = ({ 
  message, 
  priority = 'polite',
  clearAfter = 3000 
}) => {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    setCurrentMessage(message);

    if (clearAfter > 0 && message) {
      const timer = setTimeout(() => {
        setCurrentMessage('');
      }, clearAfter);

      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {currentMessage}
    </div>
  );
};

export default LiveRegion;

/**
 * Hook for managing live region announcements
 */
export const useLiveRegion = () => {
  const [announcement, setAnnouncement] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');

  const announce = (message: string, announcePriority: 'polite' | 'assertive' = 'polite') => {
    setPriority(announcePriority);
    setAnnouncement(message);
  };

  const clear = () => {
    setAnnouncement('');
  };

  return {
    announcement,
    priority,
    announce,
    clear,
    LiveRegionComponent: () => (
      <LiveRegion message={announcement} priority={priority} />
    ),
  };
};
