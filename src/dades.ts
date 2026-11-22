// Regenera dades/govern.json i dades/parlament.json des de les fonts oficials:
//   node src/dades.ts
// Primer ho llegeix i ho comprova tot; només escriu si tot quadra. Si una font falla, surt amb un
// error i deixa els fitxers com estaven, perquè es pugui executar sense ningú al davant.
import { writeFile } from 'node:fs/promises';
import { SourceError } from './comun.ts';
import { construirGovern, construirParlament } from './institucions.ts';

const avui = new Date().toISOString().slice(0, 10);
try {
  const govern = await construirGovern(fetch);
  const parlament = await construirParlament(fetch, avui);
  const desa = (nom: string, dades: unknown) =>
    writeFile(new URL(`../dades/${nom}`, import.meta.url), `${JSON.stringify(dades, null, 2)}\n`);
  await desa('govern.json', govern);
  await desa('parlament.json', parlament);
  console.log(
    `Govern: ${govern.consellers.length} consellers (dades del ${govern.data_dades}). ` +
      `Parlament: ${parlament.diputats.length} diputats en ${parlament.grups.length} grups.`,
  );
} catch (error) {
  if (!(error instanceof SourceError)) throw error;
  console.error(`No s'han actualitzat les dades: ${error.message}`);
  process.exitCode = 1;
}
