import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://finestraoberta.cat',
  integrations: [react()],
});
