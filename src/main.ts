import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { i18n } from './plugins/i18n';
import { errorHandler } from './plugins/errorHandler';

// Import global styles (if any)
import './index.css';

const app = createApp(App);

// Install plugins
app.use(createPinia());
app.use(i18n);

// Global error handler
app.config.errorHandler = errorHandler;

// Mount app
app.mount('#root');
