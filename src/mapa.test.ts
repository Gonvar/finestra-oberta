// Respostes sintètiques amb la forma de les del servei WFS de l'ICGC del 23/11/2026. Els municipis i
// els límits són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { CAPA, construirMapa } from './mapa.ts';

const CODIS = new Set(['089999', '179998']);
const quadrat = (x: number, y: number) => [
  [x, y],
  [x + 0.1, y],
  [x + 0.1, y + 0.1],
  [x, y + 0.1],
  [x, y],
];

const municipi = (codi: string, nom: string, geometry: object) => ({
  type: 'Feature',
  properties: { CODIMUNI: codi, NOMMUNI: nom, CODICOMAR: '13' },
  geometry,
});

const MUNICIPIS = [
  municipi('179998', 'Àger de Prova', { type: 'Polygon', coordinates: [quadrat(2.8, 42)] }),
  municipi('089999', 'Vilanova de Prova', {
    type: 'MultiPolygon',
    coordinates: [[quadrat(1.7, 41.2)], [quadrat(1.9, 41.3)]],
  }),
];

function fake(features: object[] = MUNICIPIS) {
  const crides: URL[] = [];
  const fetchImpl: Fetch = async (input) => {
    crides.push(new URL(String(input)));
    return Response.json({ type: 'FeatureCollection', features });
  };
  return { fetchImpl, crides };
}

test('desa els límits de cada municipi tal com els dona l’ICGC, en graus', async () => {
  const { fetchImpl, crides } = fake();
  const resultat = await construirMapa(fetchImpl, CODIS, '2026-11-23');
  const params = crides[0]!.searchParams;
  assert.equal(params.get('typeNames'), CAPA);
  assert.equal(params.get('srsName'), 'EPSG:4326');
  assert.equal(resultat.data_consulta, '2026-11-23');
  assert.deepEqual(
    resultat.municipis.map((m) => [m.codi, m.nom]),
    [
      ['089999', 'Vilanova de Prova'],
      ['179998', 'Àger de Prova'],
    ],
  );
  assert.deepEqual(resultat.municipis[0]!.geometria, MUNICIPIS[1]!.geometry);
});

test('falla si el mapa i Municat no tenen els mateixos municipis', async () => {
  const { fetchImpl } = fake(MUNICIPIS.slice(0, 1));
  await assert.rejects(construirMapa(fetchImpl, CODIS, '2026-11-23'), /falten 089999; sobren cap/);
});

test('falla si un municipi surt dues vegades', async () => {
  const { fetchImpl } = fake([...MUNICIPIS, MUNICIPIS[0]!]);
  await assert.rejects(construirMapa(fetchImpl, CODIS, '2026-11-23'), /179998 surt dues vegades/);
});

test('falla si les coordenades arriben en metres i no en graus', async () => {
  const enMetres = municipi('179998', 'Àger de Prova', {
    type: 'Polygon',
    coordinates: [quadrat(310000, 4650000)],
  });
  const { fetchImpl } = fake([enMetres, MUNICIPIS[1]!]);
  await assert.rejects(
    construirMapa(fetchImpl, CODIS, '2026-11-23'),
    /179998 no té la forma esperada/,
  );
});

test('falla si un municipi no té geometria', async () => {
  const { fetchImpl } = fake([{ ...MUNICIPIS[0]!, geometry: null }, MUNICIPIS[1]!]);
  await assert.rejects(construirMapa(fetchImpl, CODIS, '2026-11-23'), /no té la forma esperada/);
});

test('falla si un municipi no té codi', async () => {
  const senseCodi = { ...MUNICIPIS[0]!, properties: { NOMMUNI: 'Àger de Prova' } };
  const { fetchImpl } = fake([senseCodi, MUNICIPIS[1]!]);
  await assert.rejects(construirMapa(fetchImpl, CODIS, '2026-11-23'), /no té codi o nom/);
});

test('falla si el servei no torna una col·lecció', async () => {
  const fetchImpl: Fetch = async () => Response.json({ error: 'x' });
  await assert.rejects(
    construirMapa(fetchImpl, CODIS, '2026-11-23'),
    /no ha tornat una col·lecció/,
  );
});
