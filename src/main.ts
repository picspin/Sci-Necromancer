import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { i18n, i18nReady } from './plugins/i18n';
import { errorHandler } from './plugins/errorHandler';

// Import global styles (if any)
import './index.css';

const app = createApp(App);

// Install plugins
app.use(createPinia());
app.use(i18n);

// Global error handler
app.config.errorHandler = errorHandler;

// Mount app after i18n is ready to avoid missing-key warnings
void i18nReady.then(() => {
  app.mount('#root');
});
