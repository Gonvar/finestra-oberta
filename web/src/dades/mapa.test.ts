import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cami, marc } from './mapa.ts';

// Geometries sintètiques, en graus, amb la forma de dades/mapa-municipis.json.
const quadrat = (lon: number, lat: number, costat: number) => [
  [lon, lat],
  [lon + costat, lat],
  [lon + costat, lat + costat],
  [lon, lat + costat],
  [lon, lat],
];

test('cada anell és un tros tancat del camí', () => {
  const g = { type: 'MultiPolygon', coordinates: [[quadrat(1, 41, 0.1)], [quadrat(2, 42, 0.1)]] };
  const d = cami(g);
  assert.equal(d.match(/M/g)?.length, 2);
  assert.equal(d.match(/Z/g)?.length, 2);
});

test('treu els punts massa a prop de l’anterior, que no es veurien', () => {
  const anell = [
    [1, 41],
    [1.000001, 41],
    [1.1, 41],
    [1.1, 41.1],
    [1, 41],
  ];
  const d = cami({ type: 'Polygon', coordinates: [anell] });
  assert.equal(d.split('L').length, 4);
});

test('una geometria que no és un polígon no es dibuixa', () => {
  assert.throws(() => cami({ type: 'Point', coordinates: [1, 41] }), /Geometria inesperada/);
});

test('el marc inclou tots els municipis, amb el nord a dalt', () => {
  const [x, y, ample, alt] = marc([
    { type: 'Polygon', coordinates: [quadrat(1, 41, 0.1)] },
    { type: 'Polygon', coordinates: [quadrat(3, 42, 0.1)] },
  ])
    .split(' ')
    .map(Number);
  assert.ok(ample! > 0 && alt! > 0);
  // La latitud més alta queda a dalt: y és negativa i creix cap al sud.
  assert.ok(y! < -42 * 280 + 1);
  assert.ok(x! < 1 * Math.cos((41.7 * Math.PI) / 180) * 280);
});
