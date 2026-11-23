import { createHash } from 'node:crypto';
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
const fonts = { font: construeix };

async function carpetaGenerada() {
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await genera(carpeta, font, '2026-11-22', fonts, 0);
  return carpeta;
}

const llegeixProcedencia = async (carpeta: string) =>
  JSON.parse(await readFile(join(carpeta, 'procedencia.json'), 'utf8')) as Procedencia;

test('genera desa cada resposta amb la seva empremta, i les dades es poden reproduir', async () => {
  const carpeta = await carpetaGenerada();
  const procedencia = await llegeixProcedencia(carpeta);
  assert.equal(procedencia.grups.font!.data_consulta, '2026-11-22');
  assert.equal(procedencia.grups.font!.captures[1]!.url_resposta, B_FINAL);
  assert.deepEqual(
    procedencia.grups.font!.captures.map((c) => c.url),
    [A, B],
  );
  assert.equal(
    await readFile(join(carpeta, 'captures', procedencia.grups.font!.captures[1]!.sha256), 'utf8'),
    '<p>Hola</p>',
  );
  assert.deepEqual(await verifica(carpeta, fonts), {
    procedencia,
    fitxers: ['resultat.json'],
  });
  await rm(carpeta, { recursive: true });
});

test('genera esborra les còpies d’una actualització anterior', async () => {
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'captures', 'antiga'), 'x');
  await genera(carpeta, font, '2026-11-23', fonts, 0);
  await assert.rejects(readFile(join(carpeta, 'captures', 'antiga')), { code: 'ENOENT' });
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si algú retoca un JSON publicat', async () => {
  const carpeta = await carpetaGenerada();
  const fitxer = join(carpeta, 'resultat.json');
  await writeFile(fitxer, (await readFile(fitxer, 'utf8')).replace('7', '8'));
  await assert.rejects(
    verifica(carpeta, fonts),
    new DesquadreError('resultat.json no és el que surt de les còpies de les fonts.'),
  );
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si algú retoca una còpia d’una font', async () => {
  const carpeta = await carpetaGenerada();
  const { captures } = (await llegeixProcedencia(carpeta)).grups.font!;
  await writeFile(join(carpeta, 'captures', captures[0]!.sha256), '{"valor":8}');
  await assert.rejects(verifica(carpeta, fonts), DesquadreError);
  await assert.rejects(verifica(carpeta, fonts), /no té l'empremta/);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si les còpies no són les que demanen les dades', async () => {
  const carpeta = await carpetaGenerada();
  const procedencia = await llegeixProcedencia(carpeta);
  procedencia.grups.font!.captures.reverse();
  await writeFile(join(carpeta, 'procedencia.json'), JSON.stringify(procedencia));
  await assert.rejects(verifica(carpeta, fonts), /demanen https:\/\/font\.example\/a\.json/);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si sobra una còpia', async () => {
  const carpeta = await carpetaGenerada();
  const procedencia = await llegeixProcedencia(carpeta);
  procedencia.grups.font!.captures.push(procedencia.grups.font!.captures[0]!);
  await writeFile(join(carpeta, 'procedencia.json'), JSON.stringify(procedencia));
  await assert.rejects(verifica(carpeta, fonts), /només en fan servir 2/);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si els JSON no són els de procedencia.json', async () => {
  // Un JSON i les seves còpies d'una altra execució, barrejats amb el procedencia.json d'aquesta.
  const altra = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await genera(altra, font, '2026-11-23', fonts, 0);
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'resultat.json'), await readFile(join(altra, 'resultat.json')));
  await assert.rejects(verifica(carpeta, fonts), DesquadreError);
  await rm(carpeta, { recursive: true });
  await rm(altra, { recursive: true });
});

test('genera esborra els JSON que ja no es generen', async () => {
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'antic.json'), '{}');
  await genera(carpeta, font, '2026-11-23', fonts, 0);
  await assert.rejects(readFile(join(carpeta, 'antic.json')), { code: 'ENOENT' });
  await rm(carpeta, { recursive: true });
});

test('genera no toca una carpeta que no és de dades', async () => {
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'tsconfig.json'), '{}');
  await writeFile(join(carpeta, 'README.md'), 'no és una dada');
  await assert.rejects(genera(carpeta, font, '2026-11-23', fonts, 0), /no és una carpeta de dades/);
  assert.equal(await readFile(join(carpeta, 'tsconfig.json'), 'utf8'), '{}');
  await rm(carpeta, { recursive: true });
});

test('la verificació falla, sense petar, si procedencia.json no és JSON', async () => {
  const carpeta = await carpetaGenerada();
  await writeFile(join(carpeta, 'procedencia.json'), 'null');
  await assert.rejects(verifica(carpeta, fonts), DesquadreError);
  await writeFile(join(carpeta, 'procedencia.json'), '{');
  await assert.rejects(verifica(carpeta, fonts), DesquadreError);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si una còpia diu que la font no va respondre bé', async () => {
  const carpeta = await carpetaGenerada();
  const procedencia = await llegeixProcedencia(carpeta);
  procedencia.grups.font!.captures[0]!.estat = 999;
  await writeFile(join(carpeta, 'procedencia.json'), JSON.stringify(procedencia));
  await assert.rejects(verifica(carpeta, fonts), /no té la forma esperada/);
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si falta una còpia', async () => {
  const carpeta = await carpetaGenerada();
  const { captures } = (await llegeixProcedencia(carpeta)).grups.font!;
  await rm(join(carpeta, 'captures', captures[0]!.sha256));
  await assert.rejects(verifica(carpeta, fonts), DesquadreError);
  await rm(carpeta, { recursive: true });
});

test('genera torna a provar una font que talla la connexió, i només desa la resposta', async () => {
  let talls = 1;
  const fontQueTalla: Fetch = async (input, init) => {
    if (String(input) === B && talls-- > 0) throw new TypeError('fetch failed');
    return font(input, init);
  };
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await genera(carpeta, fontQueTalla, '2026-11-22', fonts, 0);
  assert.deepEqual(
    (await llegeixProcedencia(carpeta)).grups.font!.captures.map((c) => c.url),
    [A, B],
  );
  await verifica(carpeta, fonts);
  await rm(carpeta, { recursive: true });
});

test('genera falla si la font no respon després de tres intents', async () => {
  const fontCaiguda: Fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  await assert.rejects(genera(carpeta, fontCaiguda, '2026-11-22', fonts, 0), SourceError);
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
  await genera(carpeta, fontInestable, '2026-11-22', fonts, 0);
  const procedencia = await llegeixProcedencia(carpeta);
  assert.deepEqual(
    procedencia.grups.font!.captures.map((c) => [c.url, c.estat]),
    [
      [A, 200],
      [B, 200],
    ],
  );
  await verifica(carpeta, fonts);
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
  await assert.rejects(genera(carpeta, fontSenseA, '2026-11-22', fonts, 0), /404/);
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
  await reprodueix(publicada, desti, { font: nou });
  assert.deepEqual((await readdir(desti)).sort(), [
    'procedencia.json',
    'resultat.json',
    'text.json',
  ]);
  // La web hi llegeix el dia de cada font i l'empremta de cada fitxer nou.
  const { grups } = await llegeixProcedencia(desti);
  assert.equal(grups.font!.data_consulta, '2026-11-22');
  assert.deepEqual(Object.keys(grups.font!.fitxers), ['resultat.json', 'text.json']);
  assert.equal(
    grups.font!.fitxers['resultat.json'],
    createHash('sha256')
      .update(await readFile(join(desti, 'resultat.json')))
      .digest('hex'),
  );
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
    reprodueix(publicada, desti, { font: nou }),
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
  await assert.rejects(reprodueix(publicada, desti, { font: nou }), DesquadreError);
  assert.deepEqual(await readdir(desti), ['anterior.json']);
  await rm(publicada, { recursive: true });
  await rm(desti, { recursive: true });
});

test('reprodueix no serveix una còpia a una petició que no és un GET', async () => {
  const publicada = await carpetaGenerada();
  const desti = await mkdtemp(join(tmpdir(), 'reproduides-'));
  const nou: Construeix = async (fetchImpl) => {
    const resposta = await fetchImpl(A, { method: 'POST', body: '{}' });
    return { 'resultat.json': await resposta.json(), 'text.json': await getText(fetchImpl, B) };
  };
  await assert.rejects(
    reprodueix(publicada, desti, { font: nou }),
    (error) => error instanceof DesquadreError && /només són de GET/.test(error.message),
  );
  await rm(publicada, { recursive: true });
  await rm(desti, { recursive: true });
});

// Dues fonts: la segona es pot fer caure.
const C = 'https://altra.example/c.json';
let caiguda = false;
const dues: Fetch = async (input, init) => {
  if (String(input) === C)
    return caiguda ? new Response('Ocupat', { status: 503 }) : Response.json({ altra: 1 });
  return font(input, init);
};
const altra: Construeix = async (fetchImpl, data) => ({
  'altra.json': { ...(await getJson<object>(fetchImpl, C)), data },
});
const duesFonts = { font: construeix, altra };

test("si una font no respon, se'n manté l'última versió i les altres s'actualitzen", async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  caiguda = false;
  await genera(carpeta, dues, '2026-11-22', duesFonts, 0);
  const altraAhir = await readFile(join(carpeta, 'altra.json'), 'utf8');

  caiguda = true;
  const { fitxers, fallades } = await genera(carpeta, dues, '2026-11-23', duesFonts, 0);
  assert.deepEqual(Object.keys(fallades), ['altra']);
  assert.match(fallades.altra!, /503/);
  assert.deepEqual(fitxers['altra.json'], { altra: 1, data: '2026-11-22' });
  assert.equal(await readFile(join(carpeta, 'altra.json'), 'utf8'), altraAhir);
  const { grups } = await llegeixProcedencia(carpeta);
  assert.equal(grups.font!.data_consulta, '2026-11-23');
  assert.equal(grups.font!.fallada, null);
  assert.equal(grups.altra!.data_consulta, '2026-11-22');
  assert.deepEqual(grups.altra!.fallada, { data: '2026-11-23', missatge: fallades.altra });
  // Les dues fonts es poden reproduir, cadascuna amb les seves còpies i el seu dia.
  await verifica(carpeta, duesFonts);

  // Si continua caiguda, la fallada diu des de quan.
  await genera(carpeta, dues, '2026-11-24', duesFonts, 0);
  assert.equal((await llegeixProcedencia(carpeta)).grups.altra!.fallada!.data, '2026-11-23');
  await verifica(carpeta, duesFonts);

  // Quan torna a respondre, la fallada desapareix.
  caiguda = false;
  await genera(carpeta, dues, '2026-11-25', duesFonts, 0);
  const tornada = (await llegeixProcedencia(carpeta)).grups.altra!;
  assert.deepEqual([tornada.data_consulta, tornada.fallada], ['2026-11-25', null]);
  await rm(carpeta, { recursive: true });
});

test("una font que no respon i no té res publicat atura l'actualització, sense tocar la carpeta", async () => {
  const carpeta = await carpetaGenerada();
  const abans = await readFile(join(carpeta, 'procedencia.json'), 'utf8');
  caiguda = true;
  await assert.rejects(genera(carpeta, dues, '2026-11-23', duesFonts, 0), /503/);
  assert.equal(await readFile(join(carpeta, 'procedencia.json'), 'utf8'), abans);
  await rm(carpeta, { recursive: true });
});

test('si no respon cap font, no es publica res', async () => {
  const carpeta = await carpetaGenerada();
  const abans = await readFile(join(carpeta, 'procedencia.json'), 'utf8');
  const res: Fetch = async () => new Response('Ocupat', { status: 503 });
  await assert.rejects(genera(carpeta, res, '2026-11-23', fonts, 0), /No ha respost cap font/);
  assert.equal(await readFile(join(carpeta, 'procedencia.json'), 'utf8'), abans);
  await rm(carpeta, { recursive: true });
});

test("no es manté una font si el que se'n va publicar no surt de les seves còpies", async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  caiguda = false;
  await genera(carpeta, dues, '2026-11-22', duesFonts, 0);
  await writeFile(join(carpeta, 'altra.json'), '{"altra": 2}\n');
  caiguda = true;
  await assert.rejects(
    genera(carpeta, dues, '2026-11-23', duesFonts, 0),
    /no es pot mantenir: altra\.json no és el que surt/,
  );
  await rm(carpeta, { recursive: true });
});

test('un error del codi no es tracta com una font caiguda', async () => {
  const carpeta = await carpetaGenerada();
  const trencat: Construeix = async () => {
    throw new TypeError('error del codi');
  };
  await assert.rejects(
    genera(carpeta, font, '2026-11-23', { font: trencat }, 0),
    new TypeError('error del codi'),
  );
  await rm(carpeta, { recursive: true });
});

test('la verificació falla si procedencia.json no té les fonts del codi', async () => {
  const carpeta = await carpetaGenerada();
  await assert.rejects(verifica(carpeta, duesFonts), /té les fonts font, i el codi, font, altra/);
  await rm(carpeta, { recursive: true });
});

test('una font que respon amb una forma inesperada no es manté: atura la tasca', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  caiguda = false;
  await genera(carpeta, dues, '2026-11-22', duesFonts, 0);
  const abans = await readFile(join(carpeta, 'procedencia.json'), 'utf8');
  for (const resposta of [
    () => new Response('<html>'),
    () => new Response('No hi és', { status: 404 }),
  ]) {
    const canviada: Fetch = async (input, init) =>
      String(input) === C ? resposta() : font(input, init);
    await assert.rejects(genera(carpeta, canviada, '2026-11-23', duesFonts, 0), SourceError);
    assert.equal(await readFile(join(carpeta, 'procedencia.json'), 'utf8'), abans);
  }
  await rm(carpeta, { recursive: true });
});

test("una connexió tallada i un 429 també mantenen l'última versió", async () => {
  for (const falla of [
    async () => {
      throw new TypeError('fetch failed');
    },
    async () => new Response('Massa consultes', { status: 429 }),
  ]) {
    const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
    caiguda = false;
    await genera(carpeta, dues, '2026-11-22', duesFonts, 0);
    const altraAhir = await readFile(join(carpeta, 'altra.json'), 'utf8');
    const tallada: Fetch = async (input, init) =>
      String(input) === C ? falla() : font(input, init);
    const { fallades } = await genera(carpeta, tallada, '2026-11-23', duesFonts, 0);
    assert.deepEqual(Object.keys(fallades), ['altra']);
    assert.equal(await readFile(join(carpeta, 'altra.json'), 'utf8'), altraAhir);
    await rm(carpeta, { recursive: true });
  }
});

test('una URL mal formada és un error del codi, no una font caiguda', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  caiguda = false;
  await genera(carpeta, dues, '2026-11-22', duesFonts, 0);
  const abans = await readFile(join(carpeta, 'procedencia.json'), 'utf8');
  const malFormada: Construeix = async (fetchImpl) => ({
    'altra.json': await getJson<object>(fetchImpl, 'no és una URL'),
  });
  await assert.rejects(
    genera(carpeta, dues, '2026-11-23', { font: construeix, altra: malFormada }, 0),
    TypeError,
  );
  assert.equal(await readFile(join(carpeta, 'procedencia.json'), 'utf8'), abans);
  await rm(carpeta, { recursive: true });
});

test('no es manté una font si el codi ja no accepta les seves còpies', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'procedencia-'));
  caiguda = false;
  await genera(carpeta, dues, '2026-11-22', duesFonts, 0);
  const exigent: Construeix = async (fetchImpl, data) => {
    const dades = await getJson<object>(fetchImpl, C);
    if (!Object.hasOwn(dades, 'nou')) throw new SourceError('La font no té el camp nou.');
    return { 'altra.json': { ...dades, data } };
  };
  caiguda = true;
  await assert.rejects(
    genera(carpeta, dues, '2026-11-23', { font: construeix, altra: exigent }, 0),
    /no es pot mantenir: La font no té el camp nou/,
  );
  await rm(carpeta, { recursive: true });
});
