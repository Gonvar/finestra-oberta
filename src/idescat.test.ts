// Dades sintètiques amb la forma de les respostes de l'API Taules v2, no captures reals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { dadesTaula, explorar, MAX_DADES } from './idescat.ts';

const meta = {
  label: 'Població. Comarques',
  updated: '2025-12-12',
  id: ['YEAR', 'COM', 'SEX', 'CONCEPT'],
  size: [3, 3, 2, 1],
  role: { time: ['YEAR'], geo: ['COM'], metric: ['CONCEPT'] },
  dimension: {
    YEAR: { label: 'any', category: { index: ['2023', '2024', '2025'], label: { 2023: '2023', 2024: '2024', 2025: '2025' } } },
    COM: { label: 'comarca o Aran', category: { index: ['24', '13', '25'], label: { 24: 'Osona', 13: 'Barcelonès', 25: 'Pallars Jussà' } } },
    SEX: { label: 'sexe', category: { index: ['M', 'F'], label: { M: 'homes', F: 'dones' } } },
    CONCEPT: { label: 'concepte', category: { index: ['POP'], label: { POP: 'població' } } },
  },
  extension: { status: { label: { p: 'Dada provisional' } } },
};

/** Respon les metadades i, a /data, una resposta amb els valors que es donen. */
function fake(data: object) {
  const urls: string[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    return Response.json(url.includes('/data?') ? { ...meta, ...data } : meta);
  };
  return { fetchImpl, urls };
}

test('resol el filtre per nom i en dona el nom a la sèrie, amb l’estat de la dada', async () => {
  const { fetchImpl, urls } = fake({
    size: [2, 1, 1, 1],
    dimension: { ...meta.dimension, YEAR: { label: 'any', category: { index: ['2024', '2025'], label: { 2024: '2024', 2025: '2025' } } }, COM: { label: 'comarca o Aran', category: { index: ['24'], label: { 24: 'Osona' } } }, SEX: { label: 'sexe', category: { index: ['F'], label: { F: 'dones' } } } },
    value: [81532, 82348],
    status: { 1: 'p' },
  });
  const result = await dadesTaula(fetchImpl, 'pmh/446/477/com', 2, { 'comarca o aran': 'osona', SEX: 'Dones' });
  assert.match(urls[1]!, /COM=24&SEX=F&_LAST_=2/);
  assert.deepEqual(result.series, [
    {
      nom: 'Osona · dones',
      dades: [
        { periode: '2025', valor: 82348, estat: 'Dada provisional' },
        { periode: '2024', valor: 81532, estat: undefined },
      ],
    },
  ]);
});

test('ordena els trimestres pel seu lloc a la taula, no pel text', async () => {
  const quarters = { index: ['2025Q3', '2025Q4', '2026Q1'], label: { '2025Q3': 'T3/2025', '2025Q4': 'T4/2025', '2026Q1': 'T1/2026' } };
  const { fetchImpl } = fake({
    size: [3, 1, 1, 1],
    dimension: { ...meta.dimension, YEAR: { label: 'trimestre', category: quarters }, COM: { label: 'comarca o Aran', category: { index: ['24'], label: { 24: 'Osona' } } }, SEX: { label: 'sexe', category: { index: ['F'], label: { F: 'dones' } } } },
    value: [1, 2, 3],
  });
  const [serie] = (await dadesTaula(fetchImpl, 'pibt/1/2/cat', 3, { COM: 'Osona', SEX: 'dones' })).series;
  assert.deepEqual(serie!.dades.map((d) => d.periode), ['T1/2026', 'T4/2025', 'T3/2025']);
});

test('un valor que no existeix és un error, no una consulta que tornaria buida', async () => {
  const { fetchImpl, urls } = fake({});
  await assert.rejects(dadesTaula(fetchImpl, 'pmh/446/477/com', 1, { COM: 'Narnia' }), /Cap valor de «COM»/);
  await assert.rejects(dadesTaula(fetchImpl, 'pmh/446/477/com', 1, { comarca: 'Osona' }), /COM \(comarca o Aran\)/);
  assert.equal(urls.filter((u) => u.includes('/data?')).length, 0);
});

test('el període es tria amb ultims, no amb filtres', async () => {
  const { fetchImpl } = fake({});
  await assert.rejects(dadesTaula(fetchImpl, 'pmh/446/477/com', 1, { any: '2024' }), /no es filtra/);
});

test('no demana més dades que el màxim', async () => {
  const { fetchImpl } = fake({});
  const big = { ...meta, size: [60, 948, 3, 1] };
  const bigFetch: Fetch = async (input) => (String(input).includes('/data?') ? fetchImpl(input) : Response.json(big));
  await assert.rejects(dadesTaula(bigFetch, 'pmh/446/477/mun', 1), new RegExp(`màxim és ${MAX_DADES}`));
});

test('explorar dona camins relatius i filtra per paraules sense accents', async () => {
  const fetchImpl: Fetch = async () =>
    Response.json({
      label: "Padró municipal d'habitants",
      link: { item: [
        { href: 'https://api.idescat.cat/taules/v2/pmh/446?lang=ca', label: 'Població. Per sexe' },
        { href: 'https://api.idescat.cat/taules/v2/pmh/1180?lang=ca', label: 'Població. Per sexe i edat' },
      ] },
    });
  assert.deepEqual((await explorar(fetchImpl, 'pmh', 'EDAT')).elements, [
    { cami: 'pmh/1180', nom: 'Població. Per sexe i edat' },
  ]);
});
