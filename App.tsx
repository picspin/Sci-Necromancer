import React, { useState } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import { AbstractProvider } from './context/AbstractContext';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import ConferencePanel from './components/ConferencePanel';
import { AbstractManager } from './components/AbstractManager';
import ModelManager from './components/ModelManager';
import NotificationDisplay from './components/NotificationDisplay';
import { SvgIcon } from './components/SvgIcon';
import LanguageSelector from './components/LanguageSelector';
import CoffeeBadge from './components/CoffeeBadge';
import { useTranslation } from 'react-i18next';
import { getMemeTranslation } from './lib/i18n';
import FloatingTips from './components/FloatingTips';

const App: React.FC = () => {
    const { t } = useTranslation();
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
                                    <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
                                        {getMemeTranslation('Sci-Evil', t) || t('header.title')}
                                        <span className="text-2xl">🧙‍♂️</span>
                                        <CoffeeBadge />
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
                            {/* Conference Panel with integrated navigation */}
                            <ConferencePanel />
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

                        {/* Notification Display */}
                        <NotificationDisplay />

                        {/* Floating Tips Control */}
                        <FloatingTips />

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
