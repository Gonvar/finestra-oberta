// Comprova que una foto del transport surt, sense cap retoc, de les còpies de les respostes:
//   node src/verifica-foto.ts <carpeta> <fotos/AAAA-MM-DD/HHMM.json>
// <carpeta> és on hi ha la foto i les còpies, amb la mateixa estructura que a historic.finestraoberta.cat.
import { isDeepStrictEqual } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { SourceError } from './comun.ts';
import { construeixFoto, decodifica, empremta, FONTS, type Font, type Foto } from './historic.ts';

export async function verificaFoto(carpeta: string, fitxer: string) {
  const foto = JSON.parse(await readFile(join(carpeta, fitxer), 'utf8')) as Foto;
  const respostes: Partial<Record<Font, string>> = {};
  for (const c of foto.captures) {
    if (c.url !== FONTS[c.font])
      throw new SourceError(`La còpia de ${c.font} diu una adreça que no és la seva.`);
    const bytes = gunzipSync(await readFile(join(carpeta, c.fitxer)));
    if (empremta(bytes) !== c.sha256)
      throw new SourceError(`${c.fitxer} no té l'empremta que diu la foto.`);
    respostes[c.font] = decodifica(bytes, c.font);
  }
  const { captures, ...resta } = foto;
  // Es compara tal com quedaria escrita: el JSON no guarda els camps sense valor.
  const refeta = JSON.parse(
    JSON.stringify(
      construeixFoto(
        respostes,
        foto.consultat,
        'no_ha_respost' in foto.fgc ? foto.fgc.no_ha_respost : null,
      ),
    ),
  ) as unknown;
  if (!isDeepStrictEqual(refeta, resta))
    throw new SourceError(`${fitxer} no surt de les seves còpies.`);
  return foto;
}

if (import.meta.main) {
  const [carpeta, fitxer] = process.argv.slice(2);
  if (!carpeta || !fitxer) {
    console.error('Indica la carpeta i la foto: node src/verifica-foto.ts <carpeta> <fotos/…json>');
    process.exit(1);
  }
  try {
    const foto = await verificaFoto(carpeta, fitxer);
    console.log(
      `${fitxer} surt de les ${foto.captures.length} còpies, i cada còpia té la seva empremta.`,
    );
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    console.error(`La foto no quadra: ${error.message}`);
    process.exitCode = 1;
  }
}
