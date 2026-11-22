import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { fileURLToPath } from 'node:url';

// Les imatges de previsualització (src/previsualitzacio) s'escriuen amb la tipografia del repo i amb cap
// altra: sense això, una màquina sense Inter faria servir la primera font que trobés, sense cap error.
// S'ha de fixar abans que sharp faci servir fontconfig per primer cop.
process.env.FONTCONFIG_FILE = fileURLToPath(
  new URL('./src/previsualitzacio/tipus/fonts.conf', import.meta.url),
);

export default defineConfig({
  site: 'https://finestraoberta.cat',
  integrations: [react()],
});
