// Fonts i dades sintètiques: dues URL inventades i un JSON que en depèn.
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { getJson, getText, SourceError, type Fetch } from './comun.ts';
import {
  DesquadreError,
  genera,
  reprodueix,
  verifica,
  type Construeix,
  type Procedencia,
} from './procedencia.ts';

const A = 'https://font.example/a.json';
const B = 'https://font.example/b.html';

const B_FINAL = 'https://www.font.example/b.html';

/** B redirigeix: la resposta ve d'una altra adreça. */
const font: Fetch = async (input) => {
  if (String(input) === A) return Response.json({ valor: 7 });
  const resposta = new Response('<p>Hola</p>');
  Object.defineProperty(resposta, 'url', { value: B_FINAL });
  return resposta;
};

const construeix: Construeix = async (fetchImpl, data) => ({
  'resultat.json': {
    valor: (await getJson<{ valor: number }>(fetchImpl, A)).valor,
    text: await getText(fetchImpl, B),
    data,
  },
});

async function carpetaGenerada() {
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await genera(carpeta, font, '2026-11-22', construeix, 0);
  return carpeta;
}

const llegeixProcedencia = async (carpeta: string) =>
  JSON.parse(await readFile(join(carpeta, 'procedencia.json'), 'utf8')) as Procedencia;

test('genera desa cada resposta amb la seva empremta, i les dades es poden reproduir', async () => {
  const carpeta = await carpetaGenerada();
  const procedencia = await llegeixProcedencia(carpeta);
  assert.equal(procedencia.data_consulta, '2026-11-22');
  assert.equal(procedencia.captures[1]!.url_resposta, B_FINAL);
  assert.deepEqual(
    procedencia.captures.map((c) => c.url),
    [A, B],
  );
  assert.equal(
    await readFile(join(carpeta, 'captures', procedencia.captures[1]!.sha256), 'utf8'),
    '<p>Hola</p>',
  );
  assert.deepEqual(await verifica(carpeta, construeix), {
    procedencia,
    fitxers: ['resultat.json'],
  });
  await rm(carpeta, { recursive: true });
});

test('genera esborra les còpies d’una actualització anterior', async () => {
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'captures', 'antiga'), 'x');
  await genera(carpeta, font, '2026-11-23', construeix, 0);
  await assert.rejects(readFile(join(carpeta, 'captures', 'antiga')), { code: 'ENOENT' });
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si algú retoca un JSON publicat', async () => {
  const carpeta = await carpetaGenerada();
  const fitxer = join(carpeta, 'resultat.json');
  await writeFile(fitxer, (await readFile(fitxer, 'utf8')).replace('7', '8'));
  await assert.rejects(
    verifica(carpeta, construeix),
    new DesquadreError('resultat.json no és el que surt de les còpies de les fonts.'),
  );
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si algú retoca una còpia d’una font', async () => {
  const carpeta = await carpetaGenerada();
  const { captures } = await llegeixProcedencia(carpeta);
  await writeFile(join(carpeta, 'captures', captures[0]!.sha256), '{"valor":8}');
  await assert.rejects(verifica(carpeta, construeix), DesquadreError);
  await assert.rejects(verifica(carpeta, construeix), /no té l'empremta/);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si les còpies no són les que demanen les dades', async () => {
  const carpeta = await carpetaGenerada();
  const procedencia = await llegeixProcedencia(carpeta);
  procedencia.captures.reverse();
  await writeFile(join(carpeta, 'procedencia.json'), JSON.stringify(procedencia));
  await assert.rejects(verifica(carpeta, construeix), /demanen https:\/\/font\.example\/a\.json/);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si sobra una còpia', async () => {
  const carpeta = await carpetaGenerada();
  const procedencia = await llegeixProcedencia(carpeta);
  procedencia.captures.push(procedencia.captures[0]!);
  await writeFile(join(carpeta, 'procedencia.json'), JSON.stringify(procedencia));
  await assert.rejects(verifica(carpeta, construeix), /només en fan servir 2/);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si els JSON no són els de procedencia.json', async () => {
  // Un JSON i les seves còpies d'una altra execució, barrejats amb el procedencia.json d'aquesta.
  const altra = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await genera(altra, font, '2026-11-23', construeix, 0);
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'resultat.json'), await readFile(join(altra, 'resultat.json')));
  await assert.rejects(verifica(carpeta, construeix), DesquadreError);
  await rm(carpeta, { recursive: true });
  await rm(altra, { recursive: true });
});

test('genera esborra els JSON que ja no es generen', async () => {
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'antic.json'), '{}');
  await genera(carpeta, font, '2026-11-23', construeix, 0);
  await assert.rejects(readFile(join(carpeta, 'antic.json')), { code: 'ENOENT' });
  await rm(carpeta, { recursive: true });
});

test('genera no toca una carpeta que no és de dades', async () => {
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'tsconfig.json'), '{}');
  await writeFile(join(carpeta, 'README.md'), 'no és una dada');
  await assert.rejects(
    genera(carpeta, font, '2026-11-23', construeix, 0),
    /no és una carpeta de dades/,
  );
  assert.equal(await readFile(join(carpeta, 'tsconfig.json'), 'utf8'), '{}');
  await rm(carpeta, { recursive: true });
});

test('la verificació falla, sense petar, si procedencia.json no és JSON', async () => {
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'procedencia.json'), 'null');
  await assert.rejects(verifica(carpeta, construeix), DesquadreError);
  await writeFile(join(carpeta, 'procedencia.json'), '{');
  await assert.rejects(verifica(carpeta, construeix), DesquadreError);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si una còpia diu que la font no va respondre bé', async () => {
  const carpeta = await carpetaGenerada();
  const procedencia = await llegeixProcedencia(carpeta);
  procedencia.captures[0]!.estat = 999;
  await writeFile(join(carpeta, 'procedencia.json'), JSON.stringify(procedencia));
  await assert.rejects(verifica(carpeta, construeix), /no té la forma esperada/);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si falta una còpia', async () => {
  const carpeta = await carpetaGenerada();
  const { captures } = await llegeixProcedencia(carpeta);
  await rm(join(carpeta, 'captures', captures[0]!.sha256));
  await assert.rejects(verifica(carpeta, construeix), DesquadreError);
  await rm(carpeta, { recursive: true });
});

test('genera torna a provar una font que talla la connexió, i només desa la resposta', async () => {
  let talls = 1;
  const fontQueTalla: Fetch = async (input, init) => {
    if (String(input) === B && talls-- > 0) throw new TypeError('fetch failed');
    return font(input, init);
  };
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await genera(carpeta, fontQueTalla, '2026-11-22', construeix, 0);
  assert.deepEqual(
    (await llegeixProcedencia(carpeta)).captures.map((c) => c.url),
    [A, B],
  );
  await verifica(carpeta, construeix);
  await rm(carpeta, { recursive: true });
});

test('genera falla si la font no respon després de tres intents', async () => {
  const fontCaiguda: Fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await assert.rejects(genera(carpeta, fontCaiguda, '2026-11-22', construeix, 0), SourceError);
  await rm(carpeta, { recursive: true });
});

test('genera torna a provar un 503 i una resposta tallada a mig cos, i només desa la bona', async () => {
  const errors: Response[] = [
    new Response('Ocupat', { status: 503 }),
    new Response(
      new ReadableStream({
        start: (control) => control.error(new TypeError('terminated')),
      }),
    ),
  ];
  const fontInestable: Fetch = async (input, init) =>
    String(input) === A && errors.length > 0 ? errors.shift()! : font(input, init);
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await genera(carpeta, fontInestable, '2026-11-22', construeix, 0);
  const procedencia = await llegeixProcedencia(carpeta);
  assert.deepEqual(
    procedencia.captures.map((c) => [c.url, c.estat]),
    [
      [A, 200],
      [B, 200],
    ],
  );
  await verifica(carpeta, construeix);
  await rm(carpeta, { recursive: true });
});

test('genera no torna a provar un 404', async () => {
  let consultes = 0;
  const fontSenseA: Fetch = async (input, init) => {
    if (String(input) !== A) return font(input, init);
    consultes++;
    return new Response('No hi és', { status: 404 });
  };
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await assert.rejects(genera(carpeta, fontSenseA, '2026-11-22', construeix, 0), /404/);
  assert.equal(consultes, 1);
  await rm(carpeta, { recursive: true });
});

test('reprodueix genera les dades amb el codi nou a partir de les còpies, sense cap font', async () => {
  const publicada = await carpetaGenerada();
  const desti = await mkdtemp(join(tmpdir(), 'reproduides-'));
  const nou: Construeix = async (fetchImpl, data) => ({
    'resultat.json': { doble: (await getJson<{ valor: number }>(fetchImpl, A)).valor * 2 },
    'text.json': { text: await getText(fetchImpl, B), data },
  });
  await reprodueix(publicada, desti, nou);
  assert.deepEqual((await readdir(desti)).sort(), ['resultat.json', 'text.json']);
  assert.deepEqual(JSON.parse(await readFile(join(desti, 'resultat.json'), 'utf8')), { doble: 14 });
  assert.deepEqual(JSON.parse(await readFile(join(desti, 'text.json'), 'utf8')), {
    text: '<p>Hola</p>',
    data: '2026-11-22',
  });
  await rm(publicada, { recursive: true });
  await rm(desti, { recursive: true });
});

test('reprodueix falla si el codi nou demana una URL que no és a les còpies', async () => {
  const publicada = await carpetaGenerada();
  const desti = await mkdtemp(join(tmpdir(), 'reproduides-'));
  const nou: Construeix = async (fetchImpl) => ({
    'resultat.json': await getJson(fetchImpl, 'https://font.example/c.json'),
  });
  await assert.rejects(
    reprodueix(publicada, desti, nou),
    (error) =>
      error instanceof DesquadreError &&
      /demanen https:\/\/font\.example\/c\.json/.test(error.message),
  );
  await rm(publicada, { recursive: true });
  await rm(desti, { recursive: true });
});

test('reprodueix no toca la carpeta nova si el codi nou fa servir menys còpies', async () => {
  const publicada = await carpetaGenerada();
  const desti = await mkdtemp(join(tmpdir(), 'reproduides-'));
  await writeFile(join(desti, 'anterior.json'), '{}\n');
  const nou: Construeix = async (fetchImpl) => ({
    'resultat.json': await getJson(fetchImpl, A),
  });
  await assert.rejects(reprodueix(publicada, desti, nou), DesquadreError);
  assert.deepEqual(await readdir(desti), ['anterior.json']);
  await rm(publicada, { recursive: true });
  await rm(desti, { recursive: true });
});

test('reprodueix no serveix una còpia a una petició que no és un GET', async () => {
  const publicada = await carpetaGenerada();
  const desti = await mkdtemp(join(tmpdir(), 'reproduides-'));
  const nou: Construeix = async (fetchImpl) => {
    const resposta = await fetchImpl(A, { method: 'POST', body: '{}' });
    return { 'resultat.json': await resposta.json() };
  };
  await assert.rejects(reprodueix(publicada, desti, nou), DesquadreError);
  await rm(publicada, { recursive: true });
  await rm(desti, { recursive: true });
});
