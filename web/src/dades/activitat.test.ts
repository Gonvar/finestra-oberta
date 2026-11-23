import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decisions, type Sessio } from './activitat.ts';

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
