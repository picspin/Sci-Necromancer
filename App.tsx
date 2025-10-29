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
import LanguageSelector from './components/LanguageSelector';
import { useTranslation } from 'react-i18next';
import { getMemeTranslation } from './lib/i18n';

const App: React.FC = () => {
    const { t } = useTranslation();
    const [activeConference, setActiveConference] = useState<Conference>('ISMRM');
    const [showAbstractManager, setShowAbstractManager] = useState(false);
    const [showModelManager, setShowModelManager] = useState(false);

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
                                        {getMemeTranslation('Sci-Evil', t) || t('header.title')}
                                    </h1>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Abstract Manager */}
                                    <button
                                        onClick={() => setShowAbstractManager(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
                                        title={t('tooltips.abstract_manager')}
                                    >
                                        <SvgIcon type="document" className="h-5 w-5" />
                                        <span className="hidden sm:inline">{t('header.abstracts')}</span>
                                    </button>
                                    
                                    {/* Model Manager */}
                                    <button
                                        onClick={() => setShowModelManager(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
                                        title={t('tooltips.model_settings')}
                                    >
                                        <SvgIcon type="settings" className="h-5 w-5" />
                                        <span className="hidden sm:inline">{t('header.models')}</span>
                                    </button>
                                    
                                    {/* GitHub Link */}
                                    <a
                                        href="https://github.com/yourusername/sci-evil"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
                                        title={t('tooltips.github_repo')}
                                    >
                                        <SvgIcon type="github" className="h-5 w-5" />
                                    </a>
                                    
                                    {/* Language Selector */}
                                    <LanguageSelector />
                                </div>
                            </div>
                        </header>

                        {/* Main Content */}
                        <main className="max-w-7xl mx-auto px-6 py-8">
                            {/* Conference Tabs */}
                            <nav className="flex gap-2 mb-6">
                                <button
                                    onClick={() => setActiveConference('ISMRM')}
                                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                                        activeConference === 'ISMRM'
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-base-200 text-text-secondary hover:bg-base-300'
                                    }`}
                                >
                                    {t('navigation.ismrm')}
                                </button>
                                <button
                                    onClick={() => setActiveConference('RSNA')}
                                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                                        activeConference === 'RSNA'
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-base-200 text-text-secondary hover:bg-base-300'
                                    }`}
                                    disabled
                                    title={t('navigation.coming_soon')}
                                >
                                    {t('navigation.rsna')} ({t('navigation.coming_soon')})
                                </button>
                                <button
                                    onClick={() => setActiveConference('JACC')}
                                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                                        activeConference === 'JACC'
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-base-200 text-text-secondary hover:bg-base-300'
                                    }`}
                                    disabled
                                    title={t('navigation.coming_soon')}
                                >
                                    {t('navigation.jacc')} ({t('navigation.coming_soon')})
                                </button>
                            </nav>

                            {/* Conference Panels */}
                            <div>
                                {activeConference === 'ISMRM' && <ISMRMPanel />}
                                {activeConference === 'RSNA' && <RSNAPanel />}
                                {activeConference === 'JACC' && <JACCPanel />}
                            </div>
                        </main>
                        
                        {/* Abstract Manager Modal */}
                        {showAbstractManager && (
                            <AbstractManager 
                                isVisible={showAbstractManager} 
                                onClose={() => setShowAbstractManager(false)} 
                            />
                        )}
                        
                        {/* Model Manager Modal */}
                        {showModelManager && (
                            <ModelManager onClose={() => setShowModelManager(false)} />
                        )}

                        {/* Footer */}
                        <footer className="bg-base-200 border-t border-base-300 py-4 px-6 mt-12">
                            <div className="max-w-7xl mx-auto text-center text-text-secondary text-sm">
                                <p>{t('footer.copyright')}</p>
                            </div>
                        </footer>
                    </div>
                </AbstractProvider>
            </SettingsProvider>
        </ErrorBoundary>
    );
};

export default App;
