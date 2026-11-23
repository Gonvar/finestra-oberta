import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resum, SENSE_PROCEDIMENT } from './contractes.ts';

const fila = (ambit: string, procediment: string | null, inscripcions: number, import_: number) => ({
  ambit,
  organisme_codi: '1',
  organisme: 'Un organisme',
  procediment,
  inscripcions,
  import: import_,
});

test('suma per procediment i per àmbit, de més a menys import, amb la part de cada total', () => {
  const r = resum([
    fila('A', 'Menor', 90, 10),
    fila('B', 'Obert', 10, 80),
    fila('A', 'Obert', 0, 10),
  ] as Parameters<typeof resum>[0]);
  assert.deepEqual(r.total, { contractes: 100, import: 100 });
  assert.deepEqual(
    r.procediments.map((p) => [p.nom, p.contractes, p.import, p.partContractes, p.partImport]),
    [
      ['Obert', 10, 90, 0.1, 0.9],
      ['Menor', 90, 10, 0.9, 0.1],
    ],
  );
  assert.deepEqual(
    r.ambits.map((a) => [a.nom, a.import]),
    [
      ['B', 80],
      ['A', 20],
    ],
  );
});

test('un procediment sense explicar atura el build, i sense procediment té nom propi', () => {
  assert.throws(() => resum([fila('A', 'Inventat', 1, 1)] as Parameters<typeof resum>[0]), /sense explicar: Inventat/);
  const r = resum([fila('A', null, 1, 1)] as unknown as Parameters<typeof resum>[0]);
  assert.equal(r.procediments[0]!.nom, SENSE_PROCEDIMENT);
});

test('sense cap fila, el build s’atura', () => {
  assert.throws(() => resum([]), /cap fila/);
});
