import React, { useState } from 'react';
import { Conference } from '../types';
import ISMRMPanel from './ISMRMPanel';

const ConferencePanel: React.FC = () => {
  const [activeConference, setActiveConference] = useState<Conference>('ISMRM');

  return (
    <div className="bg-base-200 p-2 rounded-lg shadow-lg">
      <div className="flex border-b border-base-300 mb-4">
        <ConferenceTab 
            id="ISMRM" 
            label="ISMRM Abstract Assistant" 
            activeTab={activeConference} 
            setActiveTab={setActiveConference} 
        />
        <ConferenceTab 
            id="RSNA" 
            label="RSNA Radiology (TBD)" 
            activeTab={activeConference} 
            setActiveTab={setActiveConference} 
            disabled 
        />
        <ConferenceTab 
            id="JACC" 
            label="JACC (TBD)" 
            activeTab={activeConference} 
            setActiveTab={setActiveConference} 
            disabled 
        />
      </div>
      
      <div>
        {activeConference === 'ISMRM' && <ISMRMPanel />}
        {/* Render other panels here when they are implemented */}
      </div>
    </div>
  );
};

interface ConferenceTabProps {
    id: Conference;
    label: string;
    activeTab: Conference;
    setActiveTab: (conf: Conference) => void;
    disabled?: boolean;
}

const ConferenceTab: React.FC<ConferenceTabProps> = ({ id, label, activeTab, setActiveTab, disabled }) => (
    <button
        onClick={() => !disabled && setActiveTab(id)}
        disabled={disabled}
        className={`text-sm font-medium py-2 px-4 rounded-t-lg transition-colors duration-200 focus:outline-none ${
            activeTab === id
                ? 'border-b-2 border-brand-primary text-brand-primary'
                : 'text-text-secondary hover:bg-base-300/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {label}
    </button>
)

export default ConferencePanel;
