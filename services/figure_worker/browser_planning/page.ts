import { createApp } from 'vue';
import Harness from './Harness.vue';
if (!import.meta.env.DEV) throw new Error('Development-only synthetic planning harness');
createApp(Harness).mount('#app');
