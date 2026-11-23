// Escriu <carpeta>/resums.json, els resums de les sessions del Ple (vegeu src/resums.ts):
//   node src/resumeix.ts <carpeta> [resums.json publicat]
// Reaprofita els resums publicats vigents i demana la resta al model amb la clau
// d'ANTHROPIC_API_KEY. Cap error dels resums no atura la publicació de les dades oficials: es
// publiquen sense el resum que falta i el registre de la tasca ho avisa.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serialitza } from './procedencia.ts';
import { BUITS, construirResums, type Resums, type Sessio } from './resums.ts';

const [carpeta, publicat] = process.argv.slice(2);
if (carpeta === undefined) {
  console.error('Ús: node src/resumeix.ts <carpeta> [resums.json publicat]');
  process.exit(2);
}

const activitat = JSON.parse(await readFile(join(carpeta, 'activitat.json'), 'utf8')) as {
  sessions: Sessio[];
};

// Sense zod: la tasca de dades no instal·la cap dependència (vegeu .github/workflows/dades.yml).
const esResums = (r: unknown): r is Resums =>
  typeof r === 'object' &&
  r !== null &&
  Array.isArray((r as Resums).resums) &&
  Array.isArray((r as Resums).sense_resum);

/** La primera vegada no hi ha resums publicats, i no se n'indica cap fitxer. */
async function llegeixPublicats() {
  if (publicat === undefined) return BUITS;
  const llegit: unknown = JSON.parse(await readFile(publicat, 'utf8'));
  if (esResums(llegit)) return llegit;
  // Un resums.json d'una altra forma ve d'una versió anterior d'aquest codi: es tornen a fer tots.
  console.log(`::warning::${publicat} no té la forma esperada. Es tornen a fer tots els resums.`);
  return BUITS;
}

// Un secret que no existeix arriba com a text buit. Sense clau es publiquen els resums vigents.
const clau = process.env.ANTHROPIC_API_KEY || undefined;
const avui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const { fitxer, errors } = await construirResums(
  fetch,
  clau,
  activitat.sessions,
  await llegeixPublicats(),
  avui,
);
await writeFile(join(carpeta, 'resums.json'), serialitza(fitxer));
for (const { sessio, missatge, tipus } of errors) {
  // Una clau que falta o que l'API rebutja no s'arregla sola: surt com a error a la tasca.
  const nivell = tipus === 'configuracio' || tipus === 'clau' ? 'error' : 'warning';
  // Una línia per avís: un salt de línia del missatge de l'API podria començar una ordre del workflow.
  console.log(`::${nivell}::La sessió ${sessio} no té resum: ${missatge.replace(/\s+/g, ' ')}`);
}
console.log(`Resums: ${fitxer.resums.length} de ${activitat.sessions.length} sessions del Ple.`);
