import React, { useState } from 'react';
import { SvgIcon } from './SvgIcon';
import ModelManager from './ModelManager';

const Header: React.FC = () => {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);

  return (
    <>
      <header className="bg-base-200/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 border-b border-base-300">
            <div className="flex items-center gap-3">
               <SvgIcon type="logo" className="h-8 w-8 text-brand-primary" />
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                Academic Submission Generator
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setIsModelManagerOpen(true)} aria-label="Open model settings" className="text-text-secondary hover:text-text-primary transition-colors">
                  <SvgIcon type="settings" className="h-6 w-6" />
              </button>
              <a href="https://github.com/your-repo/academic-submission-generator" target="_blank" rel="noopener noreferrer" aria-label="GitHub Repository" className="text-text-secondary hover:text-text-primary transition-colors">
                <SvgIcon type="github" className="h-6 w-6" />
              </a>
              <div className="relative">
                <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors focus:outline-none">
                  <SvgIcon type="language" className="h-6 w-6" />
                </button>
                {langMenuOpen && (
                  <div className="absolute right-0 mt-2 w-32 bg-base-200 border border-base-300 rounded-md shadow-lg py-1 animate-fade-in">
                    <a href="#" className="block px-4 py-2 text-sm text-text-primary hover:bg-base-300">English</a>
                    <a href="#" className="block px-4 py-2 text-sm text-text-secondary opacity-50 cursor-not-allowed">中文 (TBD)</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      {isModelManagerOpen && <ModelManager onClose={() => setIsModelManagerOpen(false)} />}
    </>
  );
};

export default Header;
