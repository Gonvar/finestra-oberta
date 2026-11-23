// Publica a /dades/ els fitxers de la branca `dades` tal com hi són, perquè qualsevol persona o
// assistent els pugui descarregar i el servidor MCP de /mcp els pugui llegir.
import type { APIRoute, GetStaticPaths } from 'astro';
import { contingut, publicats } from '../../dades/publicades.ts';

export const getStaticPaths = (() =>
  publicats.map((fitxer) => ({ params: { fitxer } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(contingut(params.fitxer!), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
