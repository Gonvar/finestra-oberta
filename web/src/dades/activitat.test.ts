import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decisions, sigles, temes, type Sessio } from './activitat.ts';

const punt = (ordre: number, resultat: string | null) => ({
  ordre,
  titol: `Punt ${ordre}`,
  expedient: `200-0000${ordre}/15`,
  url_expedient: 'https://www.parlament.cat/',
  acord: 'Text de l’acord.',
  resultat,
});

const sessio = (punts: ReturnType<typeof punt>[]) => ({ punts }) as unknown as Sessio;

test('només surten els punts amb resultat, en l’ordre del dia', () => {
  const fetes = decisions(sessio([punt(1, null), punt(2, 'rebutjat'), punt(3, 'aprovat'), punt(4, null)]));
  assert.deepEqual(
    fetes.map((p) => [p.ordre, p.resultat]),
    [
      [2, 'rebutjat'],
      [3, 'aprovat'],
    ],
  );
});

test('un resultat que la web no sap dir atura el build', () => {
  assert.throws(() => decisions(sessio([punt(1, 'ajornat')])), /resultat desconegut: ajornat/);
});

test('una sessió sense decisions diu els primers temes i quants punts queden fora', () => {
  const p = (ordre: number, titol: string) => ({ ...punt(ordre, null), titol });
  const s = sessio([p(1, 'Composició del Ple'), p(2, 'Composició del Ple'), p(3, 'Composició de la Mesa'), p(4, 'Pregunta'), p(5, 'Pregunta')]);
  assert.deepEqual(temes(s, 2), { mostrats: ['Composició del Ple', 'Composició de la Mesa'], mes: 2 });
  assert.deepEqual(temes(s, 5), { mostrats: ['Composició del Ple', 'Composició de la Mesa', 'Pregunta'], mes: 0 });
});

test('les sigles de comissió al final de l’acord han d’estar explicades', () => {
  assert.deepEqual(sigles(["S'adopta. CED", "S'aprova la Llei. CAI", 'Es rebutja.', "S'adopta. CED"]), ['CAI', 'CED']);
  assert.throws(() => sigles(["S'aprova la Llei. CXYZ"]), /Falta explicar les sigles CXYZ/);
});
