// Una crida MCP de veritat al Worker, amb uns fitxers sintètics en lloc dels de la web.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cataleg, trossos } from './mcp/dades.ts';
import worker from './worker.ts';

const procedencia = { data_consulta: '2026-11-23', fitxers: { 'govern.json': 'a'.repeat(64) } };
const govern = {
  font: 'Relació d’alts càrrecs',
  url: 'https://analisi.transparenciacatalunya.cat/d/x9au-abcn',
  data_dades: '2026-09-29',
  consellers: [{ nom: 'Persona U' }],
};
// Els fitxers que genera el build de la web.
const fitxers: Record<string, unknown> = {
  'dades/govern.json': govern,
  'conjunts.json': cataleg(procedencia, () => govern),
  ...Object.fromEntries(
    Object.entries(trossos('govern', 'a'.repeat(64), govern, procedencia)).map(([cami, tros]) => [
      `conjunts/${cami}`,
      tros,
    ]),
  ),
};
const demanats: string[] = [];
let falla = false;
const env = {
  ASSETS: {
    fetch: async (request: Request) => {
      const { pathname } = new URL(request.url);
      if (falla) return new Response('', { status: 500 });
      demanats.push(pathname);
      const fitxer = pathname.slice(1);
      return fitxer in fitxers ? Response.json(fitxers[fitxer]) : new Response('', { status: 404 });
    },
  },
};

const crida = (body: object) =>
  worker.fetch(
    new Request('https://finestraoberta.cat/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-06-18',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...body }),
    }),
    env,
  );

/** El missatge JSON-RPC d'una resposta, en JSON o en un esdeveniment SSE. */
async function missatge(resposta: Response) {
  const text = await resposta.text();
  const dades = text.split('\n').find((l) => l.startsWith('data:'));
  return JSON.parse(dades === undefined ? text : dades.slice(5));
}

// Va primer: la lectura que falla no es desa, i les proves següents llegeixen els fitxers bé.
test('un error intern no arriba a l’assistent amb els seus detalls', async () => {
  falla = true;
  const { result } = await missatge(
    await crida({ method: 'tools/call', params: { name: 'llistar_conjunts', arguments: {} } }),
  );
  falla = false;
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, 'Error intern en consultar la font.');
});

test('les eines són només de lectura', async () => {
  const { result } = await missatge(await crida({ method: 'tools/list' }));
  assert.deepEqual(
    result.tools.map((t: { name: string }) => t.name),
    ['llistar_conjunts', 'veure_estructura', 'consultar'],
  );
  for (const eina of result.tools) assert.equal(eina.annotations.readOnlyHint, true);
});

test('una consulta llegeix els fitxers publicats i porta la font i la verificació', async () => {
  const { result } = await missatge(
    await crida({
      method: 'tools/call',
      params: { name: 'consultar', arguments: { conjunt: 'govern', cami: 'consellers.0' } },
    }),
  );
  assert.equal(result.isError, undefined);
  const resposta = JSON.parse(result.content[0].text);
  assert.deepEqual(resposta.resultat, { nom: 'Persona U' });
  assert.equal(resposta.fonts.data_dades, '2026-09-29');
  assert.equal(resposta.verificacio.sha256, 'a'.repeat(64));
  assert.deepEqual(demanats, [
    '/conjunts.json',
    '/conjunts/govern.json',
    '/conjunts/govern/consellers.json',
  ]);
});

test('una cerca només d’espais no passa la validació', async () => {
  const { result } = await missatge(
    await crida({
      method: 'tools/call',
      params: {
        name: 'consultar',
        arguments: { conjunt: 'govern', cami: 'consellers', cerca: '   ' },
      },
    }),
  );
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /cerca/);
});

test('la resta de la web no passa pel servidor MCP', async () => {
  const resposta = await worker.fetch(
    new Request('https://finestraoberta.cat/dades/govern.json'),
    env,
  );
  assert.equal((await resposta.json()).font, 'Relació d’alts càrrecs');
});
