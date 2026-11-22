// Regenera govern.json, parlament.json i agenda.json des de les fonts oficials, amb la còpia de cada resposta:
//   node src/dades.ts [carpeta]
// La carpeta és dades/ si no se'n diu cap altra. Primer ho llegeix i ho comprova tot; només escriu
// si tot quadra. Si una font falla, surt amb un error i deixa la carpeta com estava, perquè es pugui
// executar sense ningú al davant.
import { fileURLToPath } from 'node:url';
import { SourceError } from './comun.ts';
import { construirInstitucions } from './institucions.ts';
import { genera } from './procedencia.ts';

const carpeta = process.argv[2] ?? fileURLToPath(new URL('../dades', import.meta.url));
const avui = new Date().toISOString().slice(0, 10);
try {
  const {
    'govern.json': govern,
    'parlament.json': parlament,
    'agenda.json': agenda,
  } = await genera(carpeta, fetch, avui, construirInstitucions);
  console.log(
    `Govern: ${govern.consellers.length} consellers (dades del ${govern.data_dades}). ` +
      `Parlament: ${parlament.diputats.length} diputats en ${parlament.grups.length} grups. ` +
      `Agenda: ${agenda.govern.actes.length} actes del Govern i ${agenda.parlament.actes.length} del Parlament.`,
  );
} catch (error) {
  if (!(error instanceof SourceError)) throw error;
  console.error(`No s'han actualitzat les dades: ${error.message}`);
  process.exitCode = 1;
}
