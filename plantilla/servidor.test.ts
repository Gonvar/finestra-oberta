// Dades sintètiques amb la forma de les respostes de l'API de __ORGANISME__, no captures reals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { consultar } from './__NOM__.ts';

// TODO: la forma real de l'API, amb valors inventats. Cap captura real ni cap dada personal.
const fals =
  (resposta: object): Fetch =>
  async () =>
    Response.json(resposta);

test('torna les files amb la data de les dades', async () => {
  const resultat = await consultar(
    fals({ titol: 'Un conjunt', actualitzat: '2026-01-01', files: [{ valor: 1 }] }),
    'conjunt',
  );
  assert.equal(resultat.data_dades, '2026-01-01');
  assert.deepEqual(resultat.files, [{ valor: 1 }]);
});

test('una consulta sense resultats és un error, no una llista buida', async () => {
  await assert.rejects(
    consultar(fals({ titol: 'Un conjunt', actualitzat: '2026-01-01', files: [] }), 'res'),
    /No hi ha cap resultat/,
  );
});
