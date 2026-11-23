// El Worker de la web: Cloudflare serveix els fitxers que genera Astro sense passar per aquí, i només
// /mcp, el servidor MCP de les dades publicades, arriba a aquest codi (run_worker_first a
// wrangler.jsonc). El cron del Worker llança cada mitja hora la foto del transport.
import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import { creaDades } from './mcp/dades.ts';
import { creaServidor } from './mcp/servidor.ts';

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  /** Un token de GitHub que només pot llançar els workflows d'aquest repositori. */
  GITHUB_TOKEN: string;
};

const WORKFLOW_TRANSPORT =
  'https://api.github.com/repos/Gonvar/finestra-oberta/actions/workflows/transport.yml/dispatches';

/**
 * Llança el workflow que fa la foto del transport. El fa Cloudflare i no el `schedule` de GitHub,
 * que no s'ha disparat mai en aquest repositori. Si GitHub no l'accepta, l'error queda als registres
 * del Worker i aquella foto falta: no es torna a provar, perquè la següent arriba al cap de mitja hora.
 */
export async function llancaFotoTransport(fetchImpl: typeof fetch, token: string) {
  const resposta = await fetchImpl(WORKFLOW_TRANSPORT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      // GitHub rebutja les crides sense User-Agent.
      'User-Agent': 'finestra-oberta',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
  });
  // El cos diu per què: un 404 pot ser un token sense accés al repositori o un workflow que ja no hi és.
  if (resposta.status !== 204)
    throw new Error(
      `GitHub no ha llançat la foto del transport: ${resposta.status} ${(await resposta.text()).slice(0, 300)}`,
    );
}

// Un per Worker, perquè cada fitxer es llegeixi un sol cop: els fitxers de dades són a la mateixa
// versió del Worker, i no canvien mentre viu.
let handler: McpHttpHandler | undefined;

export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname !== '/mcp') return env.ASSETS.fetch(request);
    if (!handler) {
      const dades = creaDades(async (cami) => {
        const resposta = await env.ASSETS.fetch(new Request(new URL(`/${cami}`, request.url)));
        if (!resposta.ok) throw new Error(`/${cami} ha respost ${resposta.status}.`);
        return resposta.text();
      });
      // Sense comprovació d'Origin ni de Host: el servidor és públic, no té sessions ni credencials
      // i només llegeix fitxers que la web ja publica. Una pàgina d'un altre lloc no hi pot
      // aconseguir res que no pugui descarregar directament.
      handler = createMcpHandler(() => creaServidor(dades));
    }
    return handler.fetch(request);
  },

  async scheduled(_controller: unknown, env: Env) {
    // Un secret que no s'ha creat arriba com a undefined, i GitHub respondria amb un 401 que no diu per què.
    if (!env.GITHUB_TOKEN) throw new Error('Falta el secret GITHUB_TOKEN del Worker.');
    await llancaFotoTransport(fetch, env.GITHUB_TOKEN);
  },
};
