import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  actesFets,
  alDia,
  ambGrupInteres,
  delDia,
  elDia,
  organsActuals,
  presentacio,
  rendesDarrerAny,
  type Acte,
  type Composicio,
  type Fitxa,
} from './diputats.ts';

// Dades sintètiques amb la forma que escriu src/diputats.ts.
const acte = (titol: string, detalls: string[], desconvocat?: string): Acte => ({
  data: '2026-11-10',
  titol,
  detalls,
  enllacos: [],
  ...(desconvocat && { desconvocat }),
});
const fitxa = (anualitats: NonNullable<Fitxa['rendes']>['anualitats']): Fitxa => ({
  codi: '1',
  nom: 'Persona de prova',
  fitxa: 'https://www.parlament.cat/fitxa?p_codi=1',
  carrecs: [],
  rendes: { titol: 'Rendes', url: 'https://www.parlament.cat/rendes', blocs: [], anualitats },
  declaracions: [],
  compromisos: [],
  agenda: { url: 'https://www.parlament.cat/agenda', actes: [] },
});

test('els òrgans actuals són els que no tenen baixa, també dins d’una comissió', () => {
  const organs = organsActuals([
    { organ: 'Comissió A', alta: '2024-06-10' },
    { organ: 'Comissió B', alta: '2024-06-10', baixa: '2025-01-01' },
    {
      organ: 'Comissió C',
      relacionats: [
        { organ: 'Ponència C1', alta: '2024-06-10' },
        { organ: 'Ponència C2', alta: '2024-06-10', baixa: '2025-01-01' },
      ],
    },
  ]);
  assert.deepEqual(
    organs.map((o) => o.organ),
    ['Comissió A', 'Ponència C1'],
  );
});

test('un acte desconvocat no compta, tampoc com a reunió amb un grup d’interès', () => {
  const actes = [
    acte('Reunió', ["Grup d'interès: Associació X"]),
    acte('Reunió desconvocada', ["Grup d'interès: Associació Y"], '2026-11-09'),
    acte('Sessió', ['Sala 1']),
  ];
  assert.equal(actesFets(actes).length, 2);
  assert.deepEqual(
    ambGrupInteres(actes).map((a) => a.titol),
    ['Reunió'],
  );
});

test('les rendes són les de l’any més recent, encara que la pàgina no vagi en ordre', () => {
  const r = rendesDarrerAny(
    fitxa([
      { any: 2025, conceptes: [{ concepte: 'Indemnització', import: 100 }, { concepte: 'Dietes', import: 20.5 }] },
      { any: 2024, conceptes: [{ concepte: 'Indemnització', import: 90 }] },
    ]),
  );
  assert.deepEqual(r, { any: 2025, total: 120.5 });
});

test('una fila de total a les rendes atura el build en lloc de sumar-se dues vegades', () => {
  assert.throws(
    () =>
      rendesDarrerAny(
        fitxa([{ any: 2025, conceptes: [{ concepte: 'Sou', import: 10 }, { concepte: 'Total', import: 10 }] }]),
      ),
    /fila de total/,
  );
});

test('sense anualitats no hi ha xifra de rendes', () => {
  assert.equal(rendesDarrerAny(fitxa([])), undefined);
});

test('les dates de l’1 i de l’11 fan l’elisió', () => {
  assert.equal(elDia('3 de març del 2025'), 'el 3 de març del 2025');
  assert.equal(elDia('1 de març del 2025'), "l'1 de març del 2025");
  assert.equal(delDia('11 de març del 2025'), "de l'11 de març del 2025");
  assert.equal(delDia('21 de març del 2025'), 'del 21 de març del 2025');
  assert.equal(alDia('1 de març del 2025'), "a l'1 de març del 2025");
  assert.equal(alDia('3 de març del 2025'), 'al 3 de març del 2025');
});

test('només el càrrec de diputat o diputada va per una circumscripció', () => {
  const persona = (carrec: string) => ({ carrec, circumscripcio: 'Girona' }) as Composicio;
  assert.equal(presentacio(persona('Diputada')), 'Diputada per Girona');
  assert.equal(presentacio(persona('Consellera')), 'Persona diputada per Girona. Consellera');
});
