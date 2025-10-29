import React, { useState, useEffect } from 'react';
import { Conference } from '../types';
import { useConferenceRegistry } from '../lib/hooks/useConferenceRegistry';
import ISMRMPanel from './ISMRMPanel';
import RSNAPanel from './RSNAPanel';
import JACCPanel from './JACCPanel';

// Placeholder for ER Panel (to be implemented)
const ERPanel: React.FC = () => (
  <div className="flex items-center justify-center h-64 bg-base-100 rounded-lg">
    <div className="text-center">
      <h3 className="text-lg font-semibold text-text-primary mb-2">European Radiology</h3>
      <p className="text-text-secondary">Coming Soon</p>
      <p className="text-sm text-text-secondary mt-2">
        This module is under development and will be available in a future update.
      </p>
    </div>
  </div>
);

const ConferencePanel: React.FC = () => {
  const { initialized, activeConference, conferenceInfo, switchConference } = useConferenceRegistry();
  const [localActiveConference, setLocalActiveConference] = useState<Conference>('ISMRM');


  // Sync with conference registry
  useEffect(() => {
    if (initialized) {
      setLocalActiveConference(activeConference);
    }
  }, [initialized, activeConference]);

  const handleConferenceChange = (conference: Conference) => {
    try {
      // Save current state before switching (if needed for data persistence)
      // This could be expanded to save form data, etc.
      
      switchConference(conference);
      setLocalActiveConference(conference);
    } catch (error) {
      console.error('Failed to switch conference:', error);
      // Keep the current conference if switching fails
    }
  };

  if (!initialized) {
    return (
      <div className="bg-base-200 p-4 rounded-lg shadow-lg">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
            <p className="text-text-secondary">Loading conference modules...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base-200 p-2 rounded-lg shadow-lg">
      {/* Conference Navigation Tabs */}
      <div className="flex flex-wrap border-b border-base-300 mb-4">
        {conferenceInfo.map((conference) => (
          <ConferenceTab 
            key={conference.id}
            id={conference.id} 
            label={conference.name}
            submissionUrl={conference.submissionUrl}
            activeTab={localActiveConference} 
            setActiveTab={handleConferenceChange}
            disabled={!conference.available}
            colorScheme={conference.colorScheme}
          />
        ))}
      </div>
      
      {/* Conference Panel Content */}
      <div>
        {localActiveConference === 'ISMRM' && <ISMRMPanel />}
        {localActiveConference === 'RSNA' && <RSNAPanel />}
        {localActiveConference === 'JACC' && <JACCPanel />}
        {localActiveConference === 'ER' && <ERPanel />}
      </div>
    </div>
  );
};

interface ConferenceTabProps {
    id: Conference;
    label: string;
    submissionUrl: string;
    activeTab: Conference;
    setActiveTab: (conf: Conference) => void;
    disabled?: boolean;
    colorScheme: { primary: string; secondary: string; accent: string };
}

const ConferenceTab: React.FC<ConferenceTabProps> = ({ 
    id, 
    label, 
    submissionUrl, 
    activeTab, 
    setActiveTab, 
    disabled,
    colorScheme 
}) => {
    const isActive = activeTab === id;
    
    return (
        <div className="flex flex-col">
            {/* Tab Button */}
            <button
                onClick={() => !disabled && setActiveTab(id)}
                disabled={disabled}
                className={`text-sm font-medium py-3 px-4 rounded-t-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 min-w-[120px] ${
                    isActive
                        ? 'border-b-2 text-white shadow-md'
                        : 'text-text-secondary hover:bg-base-300/50 hover:text-text-primary'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{
                    backgroundColor: isActive ? colorScheme.primary : 'transparent',
                    borderBottomColor: isActive ? colorScheme.accent : 'transparent'
                }}
                title={disabled ? 'Coming soon' : `Switch to ${label}`}
            >
                <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold">{id}</span>
                    <span className="text-xs opacity-80 hidden sm:block">
                        {label.replace(id, '').trim()}
                    </span>
                </div>
            </button>
            
            {/* Submission Link */}
            {isActive && !disabled && submissionUrl !== '#' && (
                <div className="px-2 py-1">
                    <a
                        href={submissionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        title={`Submit to ${label}`}
                    >
                        <svg 
                            className="w-3 h-3" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                            />
                        </svg>
                        Submit
                    </a>
                </div>
            )}
        </div>
    );
}

export default ConferencePanel;