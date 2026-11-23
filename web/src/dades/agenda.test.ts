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
  parlament: {
    font: 'p',
    url: 'https://p',
    data_consulta: '2026-11-22',
    des_de: '2026-10-01',
    actes: p,
  },
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

test('dins d’un dia ordena per hora, i un acte sense hora va després del que el precedeix al web', () => {
  const { propers } = ordena(
    agenda(
      [govern('2026-11-23', '10:00', 'Visita a Reus'), govern('2026-11-23', '12:00', 'Acte')],
      [
        parlament('2026-11-23', 'Mesa del Parlament'),
        parlament('2026-11-23', 'Ple del Parlament', '10:00'),
        parlament('2026-11-23', 'Comissió de Salut'),
        parlament('2026-11-23', 'Conferència de premsa', '18:00'),
      ],
    ),
    '2026-11-22',
  );
  assert.deepEqual(
    propers[0]!.actes.map((a) => [a.institucio, a.hora, a.titol]),
    [
      ['par', undefined, 'Mesa del Parlament'],
      ['gov', '10:00', 'Visita a Reus'],
      ['par', '10:00', 'Ple del Parlament'],
      ['par', undefined, 'Comissió de Salut'],
      ['gov', '12:00', 'Acte'],
      ['par', '18:00', 'Conferència de premsa'],
    ],
  );
});

test('els actes del Govern d’avui ja s’han fet, i els del Parlament d’avui encara són previstos', () => {
  const { propers, fets } = ordena(
    agenda([govern('2026-11-22', '09:00', 'Visita')], [parlament('2026-11-22', 'Ple', '10:00')]),
    '2026-11-22',
  );
  assert.deepEqual(
    propers.flatMap((d) => d.actes.map((a) => a.titol)),
    ['Ple'],
  );
  assert.deepEqual(
    fets.flatMap((d) => d.actes.map((a) => a.titol)),
    ['Visita'],
  );
});

test('dona a tots dos actes els mateixos camps: qui, els detalls i el text', () => {
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
    detalls: ['Vic'],
    enllacos: [],
  });
  assert.deepEqual(p, {
    institucio: 'par',
    data: '2026-11-23',
    hora: '11:00',
    qui: 'Sessions dels òrgans',
    titol: 'Ple',
    detalls: ['Sessió ordinària', 'Sala 1'],
    enllacos: [],
  });
});
