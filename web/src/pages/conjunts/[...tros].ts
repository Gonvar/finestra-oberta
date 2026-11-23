// Els trossos de cada conjunt que llegeix el servidor MCP de /mcp (vegeu trossos a mcp/dades.ts).
import type { APIRoute, GetStaticPaths } from 'astro';
import { contingut, procedencia } from '../../dades/publicades.ts';
import { signats, trossos, type Valor } from '../../mcp/dades.ts';

const tots: Record<string, Valor> = Object.assign(
  {},
  ...signats(procedencia).map(({ fitxer, sha256, data_consulta }) =>
    trossos(fitxer.replace(/\.json$/, ''), sha256, JSON.parse(contingut(fitxer)), data_consulta),
  ),
);

export const getStaticPaths = (() =>
  Object.keys(tots).map((tros) => ({ params: { tros } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => Response.json(tots[params.tros!]);
