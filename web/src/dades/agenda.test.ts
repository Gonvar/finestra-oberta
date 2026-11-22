import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ordena, type ActeGovern, type ActeParlament, type Agenda } from './agenda.ts';

// Dades sintètiques amb la forma de dades/agenda.json.
const govern = (data: string, hora: string, titol: string): ActeGovern => ({
  id: titol,
  data,
  hora,
  titol,
  descripcio: `Descripció de ${titol}`,
  municipi: 'Vic',
  autoritat: 'Consellers',
  departament: 'Cultura',
});
const parlament = (data: string, titol: string, hora?: string): ActeParlament => ({
  data,
  ...(hora && { hora }),
  titol,
  detalls: ['Sessió ordinària', 'Sala 1'],
  enllacos: [],
  categoria: 'Sessions dels òrgans',
});
const agenda = (g: ActeGovern[], p: ActeParlament[]): Agenda => ({
  govern: { font: 'g', url: 'https://g', data_dades: '2026-11-21', actes: g },
  parlament: { font: 'p', url: 'https://p', data_consulta: '2026-11-22', actes: p },
});

test('separa el que és previst del que ja s’ha fet, amb els dies més propers primer', () => {
  const { propers, fets } = ordena(
    agenda(
      [govern('2026-11-20', '10:00', 'Visita'), govern('2026-11-21', '09:00', 'Inauguració')],
      [parlament('2026-11-25', 'Ple'), parlament('2026-11-22', 'Mesa', '09:30')],
    ),
    '2026-11-22',
  );
  assert.deepEqual(
    propers.map((d) => d.data),
    ['2026-11-22', '2026-11-25'],
  );
  assert.deepEqual(
    fets.map((d) => d.data),
    ['2026-11-21', '2026-11-20'],
  );
});

test('dins d’un dia ordena per hora i, a la mateixa hora, pel títol, i deixa al final els actes sense hora', () => {
  const { propers } = ordena(
    agenda(
      [govern('2026-11-23', '10:00', 'Visita a Reus'), govern('2026-11-23', '12:00', 'Acte')],
      [
        parlament('2026-11-23', 'Mesa del Parlament'),
        parlament('2026-11-23', 'Comissió de Salut', '10:00'),
      ],
    ),
    '2026-11-22',
  );
  assert.deepEqual(
    propers[0]!.actes.map((a) => [a.institucio, a.hora, a.titol]),
    [
      ['par', '10:00', 'Comissió de Salut'],
      ['gov', '10:00', 'Visita a Reus'],
      ['gov', '12:00', 'Acte'],
      ['par', undefined, 'Mesa del Parlament'],
    ],
  );
});

test('dona a tots dos actes els mateixos camps: qui, el lloc i el text', () => {
  const [g, p] = ordena(
    agenda([govern('2026-11-23', '10:00', 'Visita')], [parlament('2026-11-23', 'Ple', '11:00')]),
    '2026-11-22',
  ).propers[0]!.actes;
  assert.deepEqual(g, {
    institucio: 'gov',
    data: '2026-11-23',
    hora: '10:00',
    qui: 'Cultura',
    titol: 'Visita',
    text: 'Descripció de Visita',
    lloc: 'Vic',
    enllacos: [],
  });
  assert.deepEqual(p, {
    institucio: 'par',
    data: '2026-11-23',
    hora: '11:00',
    qui: 'Sessions dels òrgans',
    titol: 'Ple',
    lloc: 'Sessió ordinària · Sala 1',
    enllacos: [],
  });
});
