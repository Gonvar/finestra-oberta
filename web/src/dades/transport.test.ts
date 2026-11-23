import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  avui,
  momentDe,
  nomDia,
  percentatge,
  sumaLinies,
  totals,
  ultimsDies,
  type Dia,
  type LiniaRodalies,
} from './transport.ts';

const dia = (d: string, rodalies: Dia['rodalies']): Dia => ({
  dia: d,
  fotos: 48,
  primera: `${d}T00:07:00Z`,
  darrera: `${d}T23:37:00Z`,
  rodalies,
  fgc: {},
  tmb: { metro: {}, bus: {} },
});

const r = (trens: number, amb: number, cancellats = 0) => ({
  trens,
  amb_retard_de_5_min_o_mes: amb,
  cancellats,
  sense_retard_publicat: 0,
});

test('suma les línies de tots els dies, en l’ordre del codi de línia', () => {
  const dies = [
    dia('2026-11-23', { R11: r(10, 2), R2: r(20, 5, 1) }),
    dia('2026-11-22', { R2: r(30, 3), R1: r(40, 4) }),
  ];
  const linies = sumaLinies<LiniaRodalies>(dies, 'rodalies');
  assert.deepEqual(
    linies.map(([l, x]) => [l, x.trens, x.amb_retard_de_5_min_o_mes, x.cancellats]),
    [
      ['R1', 40, 4, 0],
      ['R2', 50, 8, 1],
      ['R11', 10, 2, 0],
    ],
  );
  assert.equal(totals(linies).trens, 100);
});

test('els últims dies, del més antic al més recent', () => {
  const dies = ['2026-11-23', '2026-11-22', '2026-11-21'].map((d) => dia(d, {}));
  assert.deepEqual(
    ultimsDies(dies, 2).map((d) => d.dia),
    ['2026-11-22', '2026-11-23'],
  );
});

test('sense trens no hi ha percentatge, i no és un zero', () => {
  assert.equal(percentatge(0, 0), null);
  assert.equal(percentatge(0, 7), '0 %');
  assert.equal(percentatge(1, 3), '33 %');
});

test('les dates i les hores són les de Catalunya', () => {
  assert.equal(nomDia('2026-11-23'), '23 de novembre');
  assert.equal(momentDe('2026-11-23T23:20:00Z'), 'el 24 de novembre a les 00.20');
});

test('avui és el dia a Catalunya', () => {
  assert.equal(avui(new Date('2026-11-23T23:20:00Z')), '2026-11-24');
});
