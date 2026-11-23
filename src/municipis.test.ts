// Respostes sintètiques amb la forma de l'API EMEX de l'Idescat. Els municipis són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { construirMunicipis, INDICADORS } from './municipis.ts';

const COLS = [
  { id: '089999', scheme: 'mun', content: 'Vilanova de Prova' },
  { id: '179998', scheme: 'mun', content: 'Àger de Prova' },
];
const CODIS = new Set(['089999', '179998']);

const indicador = (id: string, v = '1200,_') => ({
  id,
  c: `Indicador ${id}`,
  v,
  r: '2025',
  t: { id: 't1', content: `Taula ${id}` },
  updated: '2026-02-25T11:00:00+00:00',
});

/** Un `fetch` que respon cada crida amb els indicadors que demana. */
function fake({ cols = COLS, valors = (id: string) => indicador(id) } = {}) {
  const fetchImpl: Fetch = async (input) => {
    const ids = new URL(String(input)).searchParams.get('i')!.split(',');
    return Response.json({
      fitxes: { cols: { col: cols }, indicadors: { i: ids.map((id) => valors(id)) } },
    });
  };
  return fetchImpl;
}

test('cada municipi té tots els indicadors, i el que falta és null', async () => {
  const resultat = await construirMunicipis(fake(), CODIS);
  assert.deepEqual(
    resultat.indicadors.map((i) => i.id),
    [...INDICADORS],
  );
  assert.deepEqual(resultat.indicadors[0], {
    id: 'f171',
    nom: 'Indicador f171',
    taula: 'Taula f171',
    any: '2025',
    unitat: null,
    actualitzat: '2026-02-25',
  });
  const [ager, vilanova] = resultat.municipis;
  assert.equal(ager!.nom, 'Àger de Prova');
  assert.equal(vilanova!.valors.f171, 1200);
  assert.equal(ager!.valors.f171, null);
  assert.equal(Object.keys(ager!.valors).length, INDICADORS.length);
});

test('falla si l’Idescat i Municat no tenen els mateixos municipis', async () => {
  await assert.rejects(
    construirMunicipis(fake(), new Set(['089999', '170000'])),
    /falten 170000; sobren 179998/,
  );
});

test('falla si un indicador no té un valor per municipi', async () => {
  await assert.rejects(
    construirMunicipis(fake({ valors: (id) => indicador(id, '1200') }), CODIS),
    /1 valors per a 2 municipis/,
  );
});

test('falla si un valor no és un nombre', async () => {
  await assert.rejects(
    construirMunicipis(fake({ valors: (id) => indicador(id, '1200,molts') }), CODIS),
    /valor inesperat: molts/,
  );
});

test('falla si una crida torna territoris que no són municipis', async () => {
  const cols = [...COLS, { id: '09', scheme: 'ca', content: 'Catalunya' }];
  await assert.rejects(construirMunicipis(fake({ cols }), CODIS), /no són municipis/);
});

test('falla si la resposta no té la forma esperada', async () => {
  const fetchImpl: Fetch = async () => Response.json({ error: 'x' });
  await assert.rejects(construirMunicipis(fetchImpl, CODIS), /no té la forma esperada/);
});
