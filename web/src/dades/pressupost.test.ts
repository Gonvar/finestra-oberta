import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capitolsGeneralitat, despesa, finsA, ingressos, milions, numeroMes, percentatge, seccionsGeneralitat } from './pressupost.ts';

const seccio = (codi: string, entitat: string, pressupost: number, gastat: number) => ({
  entitat_codi: entitat,
  entitat: entitat === '1000' ? 'Generalitat' : 'Una altra',
  seccio_codi: codi,
  seccio: `Secció ${codi}`,
  ordre_protocol: '1',
  credit_inicial: pressupost,
  pressupost_definitiu: pressupost,
  obligacions_reconegudes: gastat,
  obligacions_pagades: gastat / 2,
});

const capitol = (codi: string, entitat: string, previsio: number) => ({
  entitat_codi: entitat,
  entitat: 'Generalitat',
  capitol_codi: codi,
  capitol: `Capítol ${codi}`,
  previsio_inicial: previsio,
  previsio_final: previsio,
  drets_reconeguts_nets: previsio,
  recaptacio_neta: previsio,
});

test('el mes de la font dona fins on arriben els acumulats', () => {
  assert.equal(numeroMes('10 Octubre'), 10);
  assert.equal(finsA(2026, '10 Octubre'), '2026-10-31');
  assert.equal(finsA(2028, '02 Febrer'), '2028-02-29');
  assert.throws(() => numeroMes('Octubre'), /no s'entén/);
  assert.throws(() => numeroMes('13 Tretzembre'), /no s'entén/);
});

test("només es mostra l'entitat Generalitat, i sense cap secció el build s'atura", () => {
  const files = [seccio('SA', '1000', 10, 5), seccio('X', '5100', 99, 99)];
  assert.deepEqual(
    seccionsGeneralitat(files).map((s) => s.seccio_codi),
    ['SA'],
  );
  assert.throws(() => seccionsGeneralitat([seccio('X', '5100', 1, 1)]), /cap secció/);
});

test('les seccions van de més a menys pressupost, i les que no en tenen només surten al total', () => {
  const d = despesa([seccio('A', '1000', 100, 50), seccio('B', '1000', 300, 30), seccio('C', '1000', 0, 0)]);
  assert.deepEqual(
    d.barres.map((b) => b.codi),
    ['B', 'A'],
  );
  assert.equal(d.total, 400);
  assert.equal(d.gastat, 80);
  assert.equal(d.partGastada, 0.2);
  assert.equal(d.barres[0]!.partGastada, 0.1);
});

test("un capítol d'ingressos sense explicació atura el build", () => {
  assert.throws(() => capitolsGeneralitat([capitol('10', '1000', 1)]), /sense explicar: 10/);
  assert.throws(() => capitolsGeneralitat([{ ...capitol('1', '1000', 1), capitol: null }]), /sense nom/);
  const ing = ingressos(capitolsGeneralitat([capitol('1', '1000', 30), capitol('9', '1000', 70), capitol('6', '1000', 0)]));
  assert.deepEqual(
    ing.barres.map((b) => [b.codi, b.partDelTotal, b.partIngressada]),
    [
      ['9', 0.7, 1],
      ['1', 0.3, 1],
    ],
  );
});

test('els imports es diuen en milions', () => {
  assert.equal(milions(64_612_000_000), '64.612 milions');
  assert.equal(milions(1_200_000), '1 milió');
  assert.equal(milions(400_000), 'menys d’un milió');
  assert.equal(percentatge(0.004), 'menys de l’1 %');
  assert.match(percentatge(0), /^0\s%$/);
});
