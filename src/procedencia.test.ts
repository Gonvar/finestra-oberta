// Fonts i dades sintètiques: dues URL inventades i un JSON que en depèn.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { getJson, getText, type Fetch } from './comun.ts';
import {
  DesquadreError,
  genera,
  verifica,
  type Construeix,
  type Procedencia,
} from './procedencia.ts';

const A = 'https://font.example/a.json';
const B = 'https://font.example/b.html';

const font: Fetch = async (input) =>
  String(input) === A ? Response.json({ valor: 7 }) : new Response('<p>Hola</p>');

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
