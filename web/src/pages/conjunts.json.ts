// La llista de conjunts de llistar_conjunts, que surt dels fitxers publicats a /dades/.
import type { APIRoute } from 'astro';
import { contingut, procedencia } from '../dades/publicades.ts';
import { cataleg } from '../mcp/dades.ts';

export const GET: APIRoute = () =>
  Response.json(cataleg(procedencia, (fitxer) => JSON.parse(contingut(fitxer))));
