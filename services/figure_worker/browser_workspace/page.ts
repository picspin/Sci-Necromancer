// Vite development harness only. Not an input of the production build.
import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import DataFigureWorkspace from '../../../src/components/panels/ImageGenerationPanel/DataFigureWorkspace.vue';
if (!import.meta.env.DEV) throw new Error('Development harness is not a production entry');
createApp(DataFigureWorkspace, { canRender: true })
  .use(createI18n({ legacy: false, locale: 'en', messages: {} }))
  .mount('#app');
