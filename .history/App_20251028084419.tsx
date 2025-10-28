import React, { useState } from 'react';
import { Conference } from './types';
import { SettingsProvider } from './context/SettingsContext';
import { AbstractProvider } from './context/AbstractContext';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import ISMRMPanel from './components/ISMRMPanel';
import JACCPanel from './components/JACCPanel';
import RSNAPanel from './components/RSNAPanel';
import { AbstractManager } from './components/AbstractManager';
import ModelManager from './components/ModelManager';
import { SvgIcon } from './components/SvgIcon';

const App: React.FC = () => {
    const [activeConference, setActiveConference] = useState<Conference>('ISMRM');
    const [showAbstractManager, setShowAbstractManager] = useState(false);
    const [showModelManager, setShowModelManager] = useState(false);
    const [showLangMenu, setShowLangMenu] = useState(false);

    return (
        <ErrorBoundary>
            <SettingsProvider>
                <AbstractProvider>
                    <div className="min-h-screen bg-base-100">
                        {/* Header */}
                        <header className="bg-base-200 border-b border-base-300 py-4 px-6">
                            <div className="max-w-7xl mx-auto flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <SvgIcon type="logo" className="h-8 w-8 text-brand-primary" />
                                    <h1 className="text-2xl font-bold text-brand-primary">
                                        Sci-Necromancer
                                    </h1>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Abstract Manager */}
                                    <button
                                        onClick={() => setShowAbstractManager(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
                                        title="Abstract Manager"
                                    >
                                        <SvgIcon type="document" className="h-5 w-5" />
                                        <span className="hidden sm:inline">Abstracts</span>
                                    </button>
                                    
                                    {/* Model Manager */}
                                    <button
                                        onClick={() => setShowModelManager(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
                                        title="Model Manager"
                                    >
                                        <SvgIcon type="settings" className="h-5 w-5" />
                                        <span className="hidden sm:inline">Models</span>
                                    </button>
                                    
                                    {/* GitHub Link */}
                                    <a
                                        href="https://github.com/yourusername/sci-necromancer"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
                                        title="GitHub Repository"
                                    >
                                        <SvgIcon type="github" className="h-5 w-5" />
                                    </a>
                                    
                                    {/* Language Toggle */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowLangMenu(!showLangMenu)}
                                            className="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
                                            title="Language"
                                        >
                                            <SvgIcon type="language" className="h-5 w-5" />
                                            <span className="hidden sm:inline">EN</span>
                                        </button>
                                        {showLangMenu && (
                                            <div className="absolute right-0 mt-2 w-32 bg-base-200 border border-base-300 rounded-md shadow-lg py-1 z-50">
                                                <button className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-base-300">
                                                    English
                                                </button>
                                                <button className="block w-full text-left px-4 py-2 text-sm text-text-secondary opacity-50 cursor-not-allowed">
                                                    中文 (TBD)
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </header>

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
