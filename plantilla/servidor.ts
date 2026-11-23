// Servidor MCP de __ORGANISME__: __QUE_PUBLICA__, per la seva API (__API__).
// TODO: explica en una o dues frases com és l'API i què n'has après fent-hi crides a mà.
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { getJson, READ_ONLY_EXTERNAL, run, SourceError, type Fetch } from './comun.ts';

// TODO: l'adreça de l'API, d'un domini de la taula de NEUTRALITAT.md.
const API = '__API__';
const SOURCE = 'Font: __ORGANISME__ (__DOMINI__). Cita-la quan facis servir les dades.';

// TODO: què hi pot preguntar l'assistent, com ha de fer servir les eines i com ha de llegir les dades.
const INSTRUCTIONS = `Dades de __ORGANISME__: __QUE_PUBLICA__.
Digues sempre de quina data són les dades. Un valor null és una dada que la font no dona, mai un zero.
${SOURCE}`;

type Resposta = { titol: string; actualitzat: string; files: Record<string, unknown>[] };

// TODO: substitueix aquesta eina d'exemple per les de la font. Cada eina valida l'entrada amb zod,
// torna la data de les dades i llança un SourceError, que sí que arriba a l'assistent, si la font
// no té el que es demana.
export async function consultar(fetchImpl: Fetch, q: string) {
  const resposta = await getJson<Resposta>(fetchImpl, `${API}?${new URLSearchParams({ q })}`);
  if (resposta.files.length === 0) throw new SourceError(`No hi ha cap resultat per a «${q}».`);
  return { titol: resposta.titol, data_dades: resposta.actualitzat, files: resposta.files };
}

export function __FUNCIO__(fetchImpl: Fetch = fetch) {
  const s = new McpServer(
    { name: 'finestra-oberta-__NOM__', title: '__ORGANISME__', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );
  s.registerTool(
    'consultar_dades',
    {
      title: 'Consultar dades',
      description: 'TODO: què torna aquesta eina, i de quina data són les dades.',
      inputSchema: z.object({ q: z.string().trim().min(2).max(100) }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ q }) => run(SOURCE, () => consultar(fetchImpl, q)),
  );
  return s;
}
