// Tots els fitxers que publica el workflow de dades. src/dades.ts els genera i src/verifica-dades.ts
// els torna a construir a partir de les còpies de les fonts, amb aquesta mateixa funció.
import { construirActivitat } from './activitat.ts';
import { construirAjuts } from './ajuts.ts';
import type { Fetch } from './comun.ts';
import { construirInstitucions } from './institucions.ts';

export async function construirDades(fetchImpl: Fetch, avui: string, pausaMs: number) {
  return {
    ...(await construirInstitucions(fetchImpl, avui, pausaMs)),
    'activitat.json': await construirActivitat(fetchImpl, avui, pausaMs),
    'ajuts.json': await construirAjuts(fetchImpl, avui),
  };
}
