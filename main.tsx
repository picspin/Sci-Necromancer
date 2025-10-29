import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import I18nProvider from './components/I18nProvider';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
