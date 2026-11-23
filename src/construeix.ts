// Tots els fitxers que publica el workflow de dades, agrupats per font. src/dades.ts els genera i
// src/verifica-dades.ts els torna a construir a partir de les còpies de cada font, amb aquestes
// mateixes funcions. Cada font té les seves còpies: si una no respon, les altres es publiquen igual.
import { construirActivitat } from './activitat.ts';
import { construirAjuts } from './ajuts.ts';
import type { Fetch } from './comun.ts';
import { construirContractes } from './contractes.ts';
import { construirInstitucions } from './institucions.ts';
import { construirOposicions } from './oposicions.ts';
import { construirPressupost } from './pressupost.ts';

export const FONTS = {
  institucions: (fetchImpl: Fetch, avui: string, pausaMs: number) =>
    construirInstitucions(fetchImpl, avui, pausaMs),
  activitat: async (fetchImpl: Fetch, avui: string, pausaMs: number) => ({
    'activitat.json': await construirActivitat(fetchImpl, avui, pausaMs),
  }),
  ajuts: async (fetchImpl: Fetch, avui: string) => ({
    'ajuts.json': await construirAjuts(fetchImpl, avui),
  }),
  pressupost: async (fetchImpl: Fetch) => ({
    'pressupost.json': await construirPressupost(fetchImpl),
  }),
  contractes: (fetchImpl: Fetch) => construirContractes(fetchImpl),
  oposicions: async (fetchImpl: Fetch, avui: string) => ({
    'oposicions.json': await construirOposicions(fetchImpl, avui),
  }),
};
