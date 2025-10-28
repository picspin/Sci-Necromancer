import React, { useState } from 'react';
import { Conference } from './types';
import { SettingsProvider } from './context/SettingsContext';
import { AbstractProvider } from './context/AbstractContext';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import JACCPanel from './components/JACCPanel';
import RSNAPanel from './components/RSNAPanel';
import { AbstractManager } from './components/AbstractManager';
import ApiKeyNotification from './components/ApiKeyNotification';
import AccessibilitySettings from './components/AccessibilitySettings';
import HelpDocumentation from './components/HelpDocumentation';

const App: React.FC = () => {
    const [activeConference, setActiveConference] = useState<Conference>('JACC');
    const [showManager, setShowManager] = useState(false);
    const [showA11ySettings, setShowA11ySettings] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    return (
        <ErrorBoundary>
            <SettingsProvider>
                <AbstractProvider>
                    {/* Skip to main content link for keyboard navigation */}
                    <a 
                        href="#main-content" 
                        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-md"
                    >
                        Skip to main content
                    </a>
                    
                    <div className="min-h-screen bg-base-100">
                        {/* Header */}
                        <header 
                            className="bg-base-200 border-b border-base-300 py-4 px-6"
                            role="banner"
                        >
                            <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
                                <h1 className="text-2xl font-bold text-brand-primary">
                                    Sci-Necromancer
                                    <span className="sr-only">- Academic Submission Generator</span>
                                </h1>
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => setShowHelp(true)}
                                        className="px-4 py-2 bg-base-300 text-white rounded-lg hover:bg-base-300/80 transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary"
                                        aria-label="Open help documentation"
                                        title="Help & Documentation"
                                    >
                                        <span aria-hidden="true">?</span>
                                        <span className="ml-2 hidden sm:inline">Help</span>
                                    </button>
                                    <button
                                        onClick={() => setShowA11ySettings(true)}
                                        className="px-4 py-2 bg-base-300 text-white rounded-lg hover:bg-base-300/80 transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary"
                                        aria-label="Open accessibility settings"
                                        title="Accessibility Settings"
                                    >
                                        <span aria-hidden="true">♿</span>
                                        <span className="ml-2 hidden sm:inline">Accessibility</span>
                                    </button>
                                    <button
                                        onClick={() => setShowManager(!showManager)}
                                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary"
                                        aria-expanded={showManager}
                                        aria-controls="abstract-manager"
                                        aria-label={showManager ? 'Hide saved abstracts manager' : 'Show saved abstracts manager'}
                                    >
                                        {showManager ? 'Hide' : 'Show'} Saved Abstracts
                                    </button>
                                </div>
                            </div>
                        </header>
                        
                        {/* Help Documentation Modal */}
                        <HelpDocumentation 
                            isOpen={showHelp} 
                            onClose={() => setShowHelp(false)} 
                        />
                        
                        {/* Accessibility Settings Modal */}
                        <AccessibilitySettings 
                            isOpen={showA11ySettings} 
                            onClose={() => setShowA11ySettings(false)} 
                        />

                        {/* API Key Notification - Commented out for now, needs settings modal */}
                        {/* <ApiKeyNotification provider="google" onOpenSettings={() => {}} /> */}

                        {/* Main Content */}
                        <main 
                            id="main-content"
                            className="max-w-7xl mx-auto px-6 py-8"
                            role="main"
                            aria-label="Main content"
                        >
                            {showManager ? (
                                <section 
                                    id="abstract-manager"
                                    aria-label="Saved abstracts manager"
                                >
                                    <AbstractManager isVisible={showManager} onClose={() => setShowManager(false)} />
                                </section>
                            ) : (
                                <>
                                    {/* Conference Tabs */}
                                    <nav 
                                        className="flex gap-2 mb-6"
                                        role="tablist"
                                        aria-label="Conference selection"
                                    >
                                        <button
                                            onClick={() => setActiveConference('JACC')}
                                            className={`px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary ${activeConference === 'JACC'
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-base-200 text-text-secondary hover:bg-base-300'
                                                }`}
                                            role="tab"
                                            aria-selected={activeConference === 'JACC'}
                                            aria-controls="conference-panel"
                                            id="tab-jacc"
                                        >
                                            JACC
                                        </button>
                                        <button
                                            onClick={() => setActiveConference('RSNA')}
                                            className={`px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary ${activeConference === 'RSNA'
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-base-200 text-text-secondary hover:bg-base-300'
                                                }`}
                                            role="tab"
                                            aria-selected={activeConference === 'RSNA'}
                                            aria-controls="conference-panel"
                                            id="tab-rsna"
                                        >
                                            RSNA
                                        </button>
                                        <button
                                            onClick={() => setActiveConference('ISMRM')}
                                            className={`px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary ${activeConference === 'ISMRM'
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-base-200 text-text-secondary hover:bg-base-300'
                                                }`}
                                            disabled
                                            title="Coming soon"
                                            role="tab"
                                            aria-selected={activeConference === 'ISMRM'}
                                            aria-controls="conference-panel"
                                            aria-disabled="true"
                                            id="tab-ismrm"
                                        >
                                            ISMRM (Coming Soon)
                                        </button>
                                    </nav>

                                    {/* Conference Panels */}
                                    <div 
                                        id="conference-panel"
                                        role="tabpanel"
                                        aria-labelledby={`tab-${activeConference.toLowerCase()}`}
                                    >
                                        {activeConference === 'JACC' && <JACCPanel />}
                                        {activeConference === 'RSNA' && <RSNAPanel />}
                                    </div>
                                </>
                            )}
                        </main>

                        {/* Footer */}
                        <footer 
                            className="bg-base-200 border-t border-base-300 py-4 px-6 mt-12"
                            role="contentinfo"
                        >
                            <div className="max-w-7xl mx-auto text-center text-text-secondary text-sm">
                                <p>Sci-Necromancer - Academic Submission Generator</p>
                            </div>
                        </footer>
                    </div>
                </AbstractProvider>
            </SettingsProvider>
        </ErrorBoundary>
    );
};

export default App;
