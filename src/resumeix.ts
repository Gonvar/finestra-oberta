// Els resums de les sessions del Ple (vegeu src/resums.ts):
//   node src/resumeix.ts pendents <carpeta> [resums.json publicat]
//     Diu quantes sessions de <carpeta>/activitat.json no tenen un resum vigent. No crida l'API.
//   node src/resumeix.ts genera <carpeta> [resums.json publicat]
//     Escriu <carpeta>/resums.json. Reaprofita els resums publicats vigents i demana la resta al
//     model amb la clau d'ANTHROPIC_API_KEY.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serialitza } from './procedencia.ts';
import { construirResums, pendents, type Resum, type Resums, type Sessio } from './resums.ts';

const [ordre, carpeta, publicat] = process.argv.slice(2);
if ((ordre !== 'pendents' && ordre !== 'genera') || carpeta === undefined) {
  console.error('Ús: node src/resumeix.ts pendents|genera <carpeta> [resums.json publicat]');
  process.exit(2);
}

const activitat = JSON.parse(await readFile(join(carpeta, 'activitat.json'), 'utf8')) as {
  sessions: Sessio[];
};
// La primera vegada no hi ha resums publicats, i no se n'indica cap fitxer.
const publicats: Resum[] =
  publicat === undefined ? [] : (JSON.parse(await readFile(publicat, 'utf8')) as Resums).resums;

if (ordre === 'pendents') {
  console.log(pendents(activitat.sessions, publicats).length);
} else {
  const clau = process.env.ANTHROPIC_API_KEY;
  if (clau === undefined || clau === '') {
    console.error('Falta la clau de l’API a ANTHROPIC_API_KEY.');
    process.exit(1);
  }
  const avui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const { fitxer, errors } = await construirResums(
    fetch,
    clau,
    activitat.sessions,
    publicats,
    avui,
  );
  await writeFile(join(carpeta, 'resums.json'), serialitza(fitxer));
  // Una sessió sense resum no atura la publicació de les dades: queda pendent per a l'execució següent.
  for (const { sessio, missatge } of errors)
    console.log(`::warning::La sessió ${sessio} no té resum: ${missatge}`);
  console.log(`Resums: ${fitxer.resums.length} de ${activitat.sessions.length} sessions del Ple.`);
}
