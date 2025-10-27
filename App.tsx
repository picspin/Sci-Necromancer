import React from 'react';
import Header from './components/Header';
import ConferencePanel from './components/ConferencePanel';
import { SettingsProvider } from './context/SettingsContext';

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <div className="min-h-screen bg-base-100 font-sans">
        <Header />
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <ConferencePanel />
        </main>
      </div>
    </SettingsProvider>
  );
};

export default App;
