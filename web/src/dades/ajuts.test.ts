import { test } from 'node:test';
import assert from 'node:assert/strict';
import { administracio, convocatoriesEnText, resum, SENSE_DADA } from './ajuts.ts';

const PERSONES = 'Persones físiques que no desenvolupen activitat econòmica';
const EMPRESES = 'PYME i Pers. físiques que desenvolupen activitat econòmica';
const AMB = 'Subvenció amb concurrència';
const AVUI = '2026-11-23';

const conv = (
  finalitat: string | null,
  beneficiaris: string | null,
  import_total: number | null = 10,
) => ({
  inici: '2026-11-01',
  administracio: 'Local / Municipi',
  finalitat,
  beneficiaris,
  tipus: AMB,
  import_total,
});

test('compta per finalitat, de més a menys i, si empaten, per ordre alfabètic', () => {
  const r = resum(
    [
      conv('Cultura', PERSONES),
      conv('Educació', PERSONES),
      conv('Educació', PERSONES),
      conv('Altres', PERSONES),
    ],
    AVUI,
  );
  assert.equal(r.total, 4);
  assert.deepEqual(
    r.finalitats.map((f) => [f.nom, f.convocatories, f.part]),
    [
      ['Educació', 2, 0.5],
      ['Altres', 1, 0.25],
      ['Cultura', 1, 0.25],
    ],
  );
});

test('una convocatòria per a més d’un tipus de beneficiari compta a cadascun', () => {
  const r = resum([conv('Cultura', `${PERSONES}; ${EMPRESES}`), conv('Cultura', PERSONES)]);
  assert.deepEqual(
    r.beneficiaris.map((b) => [b.nom, b.convocatories]),
    [
      [PERSONES, 2],
      [EMPRESES, 1],
    ],
  );
});

test('un beneficiari o un tipus sense explicar atura el build', () => {
  assert.throws(
    () => resum([conv('Cultura', 'Una categoria nova')], AVUI),
    /sense explicar: Una categoria nova/,
  );
  assert.throws(
    () => resum([{ ...conv('Cultura', PERSONES), tipus: 'Un altre' }], AVUI),
    /sense explicar: Un altre/,
  );
});

test('el que la font no dona es diu, i un import que falta no compta com a zero', () => {
  const r = resum([conv(null, null, null), conv('Cultura', PERSONES, 30)], AVUI);
  assert.equal(r.import, 30);
  assert.equal(r.senseImport, 1);
  assert.deepEqual(r.finalitats.map((f) => f.nom).sort(), ['Cultura', SENSE_DADA].sort());
  assert.ok(r.beneficiaris.some((b) => b.nom === SENSE_DADA));
});

test('textos', () => {
  assert.equal(administracio('Local / Municipi'), 'Municipi');
  assert.equal(administracio('Autonòmica'), 'Autonòmica');
  assert.equal(convocatoriesEnText(1, String), '1 convocatòria');
  assert.equal(convocatoriesEnText(2, String), '2 convocatòries');
});

test('compta les que encara no han obert el termini', () => {
  const r = resum(
    [
      conv('Cultura', PERSONES),
      { ...conv('Cultura', PERSONES), inici: '2026-12-01' },
      { ...conv('Cultura', PERSONES), inici: null },
    ],
    AVUI,
  );
  assert.equal(r.perObrir, 1);
});
