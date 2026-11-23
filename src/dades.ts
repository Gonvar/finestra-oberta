// Regenera govern.json, parlament.json, ajuntaments.json i activitat.json des de les fonts oficials, amb la còpia de cada resposta:
//   node src/dades.ts [carpeta]
// La carpeta és dades/ si no se'n diu cap altra. Primer ho llegeix i ho comprova tot; només escriu
// si tot quadra. Si una font falla, surt amb un error i deixa la carpeta com estava, perquè es pugui
// executar sense ningú al davant.
import { fileURLToPath } from 'node:url';
import { SourceError } from './comun.ts';
import { construirDades } from './construeix.ts';
import { genera } from './procedencia.ts';

const carpeta = process.argv[2] ?? fileURLToPath(new URL('../dades', import.meta.url));
const avui = new Date().toISOString().slice(0, 10);
try {
  const {
    'govern.json': govern,
    'parlament.json': parlament,
    'ajuntaments.json': ajuntaments,
    'activitat.json': activitat,
  } = await genera(carpeta, fetch, avui, construirDades);
  console.log(
    `Govern: ${govern.consellers.length} consellers (dades del ${govern.data_dades}). ` +
      `Parlament: ${parlament.diputats.length} diputats en ${parlament.grups.length} grups. ` +
      `Ajuntaments: ${ajuntaments.municipis.length} municipis i ` +
      `${ajuntaments.municipis.reduce((n, m) => n + m.ple.length, 0)} persones als plens ` +
      `(dades del ${ajuntaments.data_dades}). ` +
      `Activitat: ${activitat.sessions.length} sessions del Ple i ${activitat.normes.normes.length} normes.`,
  );
} catch (error) {
  if (!(error instanceof SourceError)) throw error;
  console.error(`No s'han actualitzat les dades: ${error.message}`);
  process.exitCode = 1;
}
