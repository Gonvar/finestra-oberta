// El Worker de la web: Cloudflare serveix els fitxers que genera Astro sense passar per aquí, i només
// /mcp, el servidor MCP de les dades publicades, arriba a aquest codi (run_worker_first a
// wrangler.jsonc).
import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import { creaDades } from './mcp/dades.ts';
import { creaServidor } from './mcp/servidor.ts';

type Env = { ASSETS: { fetch: (request: Request) => Promise<Response> } };

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
};
