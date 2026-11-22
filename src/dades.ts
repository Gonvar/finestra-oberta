// Regenera dades/govern.json, dades/transparencia.json i dades/parlament.json des de les fonts oficials:
//   node src/dades.ts
// Primer ho llegeix i ho comprova tot; només escriu si tot quadra. Si una font falla, surt amb un
// error i deixa els fitxers com estaven, perquè es pugui executar sense ningú al davant.
import { readFile, writeFile } from 'node:fs/promises';
import { SourceError } from './comun.ts';
import {
  construirGovern,
  construirParlament,
  construirTransparencia,
  llegirPerfils,
} from './institucions.ts';

const avui = new Date().toISOString().slice(0, 10);
const dades = (nom: string) => new URL(`../dades/${nom}`, import.meta.url);
try {
  // govern.cat no respon als scripts: les fotos i els currículums es copien a mà (docs/institucions.md).
  const perfils = llegirPerfils(await readFile(dades('perfils-govern.json'), 'utf8'));
  const govern = await construirGovern(fetch, perfils);
  const transparencia = await construirTransparencia(fetch, [
    govern.president,
    ...govern.consellers,
  ]);
  const parlament = await construirParlament(fetch, avui);
  const desa = (nom: string, contingut: unknown) =>
    writeFile(dades(nom), `${JSON.stringify(contingut, null, 2)}\n`);
  await desa('govern.json', govern);
  await desa('transparencia.json', transparencia);
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
