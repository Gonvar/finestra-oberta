// Les regles de CONTRIBUTING.md i NEUTRALITAT.md per a cada font del registre. Una font nova que no
// les compleixi fa fallar la CI.
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { esDelDomini, llegeixDominis } from './neutralitat.ts';
import { servidors, type Servidor } from './servidors.ts';

const arrel = new URL('../', import.meta.url);
const llegeix = (cami: string) => readFile(new URL(cami, arrel), 'utf8');
const existeix = (cami: string) =>
  access(new URL(cami, arrel)).then(
    () => true,
    () => false,
  );

type Eina = {
  name: string;
  title?: string;
  description?: string;
  annotations?: Record<string, boolean>;
};

/** Les eines i les instruccions del servidor, demanades per MCP com ho faria un assistent. */
async function descriu(servidor: Servidor) {
  // Un fetch que falla: descriure el servidor no ha de consultar la font.
  const handler = createMcpHandler(() =>
    servidor.crea(async () => {
      throw new Error('Descriure el servidor no pot consultar la font.');
    }),
  );
  const crida = async (method: string, params: object) => {
    const resposta = await handler.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      }),
    );
    const text = await resposta.text();
    const dades = text.split('\n').find((l) => l.startsWith('data:'));
    return JSON.parse(dades === undefined ? text : dades.slice(5)).result;
  };
  const inici = await crida('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'prova', version: '1' },
  });
  const { tools } = await crida('tools/list', {});
  return { inici, eines: tools as Eina[] };
}

test('cada font té un nom únic, en minúscules i amb guions', () => {
  const noms = servidors.map((s) => s.nom);
  assert.equal(new Set(noms).size, noms.length);
  for (const nom of noms) assert.match(nom, /^[a-z]+(-[a-z]+)*$/);
});

test('cada servidor de src/ és al registre, i per això la CI el comprova', async () => {
  const registrades = new Set(servidors.map((s) => s.crea.name));
  for (const fitxer of await readdir(new URL('src/', arrel))) {
    if (!fitxer.endsWith('.ts') || fitxer.endsWith('.test.ts')) continue;
    const codi = await llegeix(`src/${fitxer}`);
    for (const [, funcio] of codi.matchAll(/export function (create\w+Server)\b/g))
      assert.ok(
        registrades.has(funcio as string),
        `${funcio}, de src/${fitxer}, no és a src/servidors.ts.`,
      );
    assert.doesNotMatch(
      fitxer === 'index.ts' ? '' : codi,
      /serveStdio/,
      `src/${fitxer} serveix un servidor pel seu compte: ha de passar per src/index.ts i el registre.`,
    );
  }
});

for (const servidor of servidors) {
  test(`${servidor.nom}: la font és oficial i en diu la llicència`, async () => {
    const dominis = await llegeixDominis();
    assert.ok(servidor.fonts.length > 0, 'Cal almenys una font.');
    for (const font of servidor.fonts) {
      assert.ok(
        dominis.includes(font.domini),
        `${font.domini} no és a la taula de fonts oficials de NEUTRALITAT.md.`,
      );
      if (font.llicencia !== 'per conjunt')
        assert.ok(
          dominis.some((d) => esDelDomini(font.llicencia, d)),
          `La llicència (${font.llicencia}) ha de ser una pàgina d'un domini de NEUTRALITAT.md.`,
        );
    }
  });

  test(`${servidor.nom}: té proves, documentació, ordre i lloc al README`, async () => {
    assert.match(servidor.proves, /^src\/[a-z-]+\.test\.ts$/);
    assert.ok(await existeix(servidor.proves), `Falta ${servidor.proves}.`);
    assert.match(servidor.docs, /^docs\/[a-z-]+\.md$/);
    const docs = await llegeix(servidor.docs);
    for (const { llicencia } of servidor.fonts)
      if (llicencia === 'per conjunt')
        assert.match(
          docs,
          /llicència/i,
          `${servidor.docs} ha d'explicar d'on surt la llicència de cada conjunt.`,
        );
      else
        assert.ok(
          docs.includes(llicencia),
          `${servidor.docs} ha d'enllaçar la llicència, ${llicencia}.`,
        );
    const { scripts } = JSON.parse(await llegeix('package.json'));
    assert.equal(scripts[servidor.nom], `node src/index.ts ${servidor.nom}`);
    assert.ok(
      (await llegeix('README.md')).includes(`| [\`${servidor.nom}\`](${servidor.docs})`),
      `La taula de servidors del README no té ${servidor.nom}.`,
    );
  });

  test(`${servidor.nom}: no queda cap TODO de la plantilla`, async () => {
    const fitxers = [servidor.docs, servidor.proves, servidor.proves.replace(/\.test\.ts$/, '.ts')];
    for (const fitxer of fitxers)
      assert.doesNotMatch(
        await llegeix(fitxer),
        /TODO|__[A-Z_]+__/,
        `${fitxer} encara té algun TODO.`,
      );
    assert.doesNotMatch(JSON.stringify(servidor), /TODO/, 'src/servidors.ts encara té algun TODO.');
    const fila = (await llegeix('README.md'))
      .split('\n')
      .find((l) => l.includes(`[\`${servidor.nom}\`]`));
    assert.ok(fila, `La taula de servidors del README no té ${servidor.nom}.`);
    assert.doesNotMatch(fila, /TODO/, 'La fila del README encara té algun TODO.');
  });

  test(`${servidor.nom}: totes les eines són de només lectura i estan descrites`, async () => {
    const { inici, eines } = await descriu(servidor);
    assert.equal(inici.serverInfo.name, `finestra-oberta-${servidor.nom}`);
    assert.ok(inici.instructions, 'El servidor no té instruccions per a l’assistent.');
    assert.ok(eines.length > 0, 'El servidor no té cap eina.');
    for (const eina of eines) {
      assert.match(
        eina.name,
        /^[a-z]+(_[a-z]+)*$/,
        `${eina.name}: el nom va en minúscules i amb _.`,
      );
      assert.ok(eina.title && eina.description, `${eina.name} no té títol o descripció.`);
      assert.equal(eina.annotations?.readOnlyHint, true, `${eina.name} no és de només lectura.`);
      assert.equal(eina.annotations?.destructiveHint, false, `${eina.name} pot destruir.`);
    }
  });
}
