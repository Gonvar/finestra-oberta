// Respostes sintètiques amb la forma de les de l'API del CIDO del 23/11/2026. Les institucions i
// els processos són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { CIDO, construirOposicions } from './oposicions.ts';

const ATRIBUTS = {
  institucioDesenvolupat: 'Ajuntament A',
  ambit: 'Municipis província de Barcelona i ens adscrits',
  titol: '1 plaça de tècnic',
  borsaTreball: false,
  identificador: '20261101O1',
  dataInici: '2026-11-01',
  dataFinalitzacio: '2026-12-10',
  horaFinalitzacio: null,
  observacionsTermini: null,
  sistemaSeleccio: 'Concurs oposició',
  tipusPersonal: 'Funcionari',
  grupTitulacio: 'A2 - Diplomatura o grau',
  numPlaces: 1,
  idEstat: 3,
  estat: 'Termini obert',
  urlCido: 'https://cido.diba.cat/oposicions/10',
};

const proces = (id: string, atributs: Record<string, unknown> = {}) => ({
  id,
  type: 'oposicions',
  attributes: { ...ATRIBUTS, ...atributs },
});

const PROCESSOS = [
  proces('10'),
  proces('7', {
    titol: 'Borsa de treball de monitors',
    borsaTreball: true,
    dataFinalitzacio: null,
    observacionsTermini: 'Obert permanentment',
    numPlaces: 0,
  }),
  proces('12', { dataFinalitzacio: '2026-11-30', horaFinalitzacio: '14:00' }),
];

/** Una font que dona `processos` en pàgines de `mida`, com l'API amb page[limit] i page[offset]. */
function font(processos: unknown[], { mida = 2000, total = processos.length } = {}) {
  const urls: URL[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    const offset = Number(url.searchParams.get('page[offset]'));
    return Response.json({
      data: processos.slice(offset, offset + mida),
      meta: { totalResourceCount: total },
    });
  };
  return { fetchImpl, urls };
}

test('publica els processos amb el termini obert, ordenats per la data de finalització', async () => {
  const { fetchImpl, urls } = font(PROCESSOS);
  const oposicions = await construirOposicions(fetchImpl, '2026-11-23');
  assert.equal(urls.length, 1);
  assert.equal(`${urls[0]!.origin}${urls[0]!.pathname}`, CIDO);
  assert.equal(urls[0]!.searchParams.get('filter[idEstat]'), '3');
  assert.equal(urls[0]!.searchParams.get('sort'), 'id');
  assert.equal(oposicions.data_consulta, '2026-11-23');
  // El que no té data de finalització va al final.
  assert.deepEqual(
    oposicions.processos.map((p) => [p.id, p.fi]),
    [
      ['12', '2026-11-30'],
      ['10', '2026-12-10'],
      ['7', null],
    ],
  );
  assert.deepEqual(oposicions.processos[0], {
    id: '12',
    identificador: '20261101O1',
    titol: '1 plaça de tècnic',
    institucio: 'Ajuntament A',
    ambit: 'Municipis província de Barcelona i ens adscrits',
    borsa_treball: false,
    tipus_personal: 'Funcionari',
    grup_titulacio: 'A2 - Diplomatura o grau',
    sistema_seleccio: 'Concurs oposició',
    places: 1,
    inici: '2026-11-01',
    fi: '2026-11-30',
    hora_fi: '14:00',
    observacions_termini: null,
    url: 'https://cido.diba.cat/oposicions/10',
  });
  assert.equal(oposicions.processos[2]!.observacions_termini, 'Obert permanentment');
  assert.equal(oposicions.processos[2]!.places, 0);
});

test('llegeix totes les pàgines fins al total que diu la font', async () => {
  const { fetchImpl, urls } = font(PROCESSOS, { mida: 2 });
  const oposicions = await construirOposicions(fetchImpl, '2026-11-23');
  assert.deepEqual(
    urls.map((u) => u.searchParams.get('page[offset]')),
    ['0', '2'],
  );
  assert.equal(oposicions.processos.length, 3);
});

test("s'atura si les pàgines no lliguen amb el total o un procés surt dues vegades", async () => {
  const menys = font(PROCESSOS, { total: 4 });
  await assert.rejects(construirOposicions(menys.fetchImpl, '2026-11-23'), /n'ha donat 3/);
  const repetit = font([PROCESSOS[0], PROCESSOS[0]]);
  await assert.rejects(construirOposicions(repetit.fetchImpl, '2026-11-23'), /dues vegades/);
  const buida = font([]);
  await assert.rejects(construirOposicions(buida.fetchImpl, '2026-11-23'), /cap procés/);
  // Si la font canvia entre una pàgina i la següent, les pàgines no lliguen.
  let crida = 0;
  const canvia: Fetch = async (input) => {
    const offset = Number(new URL(String(input)).searchParams.get('page[offset]'));
    crida += 1;
    return Response.json({
      data: PROCESSOS.slice(offset, offset + 2),
      meta: { totalResourceCount: crida === 1 ? 3 : 4 },
    });
  };
  await assert.rejects(construirOposicions(canvia, '2026-11-23'), /ha canviat/);
});

test("s'atura si un procés no és obert o li falta un camp obligatori o té un valor inesperat", async () => {
  const casos: [Record<string, unknown>, RegExp][] = [
    [{ idEstat: 4 }, /no té el termini obert/],
    [{ titol: '' }, /no té titol/],
    [{ institucioDesenvolupat: null }, /no té institucioDesenvolupat/],
    [{ dataFinalitzacio: '10/12/2026' }, /no és una data/],
    [{ numPlaces: '1' }, /places/],
    [{ borsaTreball: null }, /borsa de treball/],
    [{ tipusPersonal: 3 }, /no és text/],
    [{ tipusPersonal: undefined }, /no porta tipusPersonal/],
    [{ dataInici: '2026-02-30' }, /no és una data/],
    [{ dataInici: '2026-13-01' }, /no és una data/],
  ];
  for (const [atributs, error] of casos) {
    const { fetchImpl } = font([proces('10', atributs)]);
    await assert.rejects(construirOposicions(fetchImpl, '2026-11-23'), error);
  }
  const altre = font([{ ...proces('10'), type: 'subvencions' }]);
  await assert.rejects(construirOposicions(altre.fetchImpl, '2026-11-23'), /recurs subvencions/);
  const id = font([proces('x10')]);
  await assert.rejects(construirOposicions(id.fetchImpl, '2026-11-23'), /Identificador/);
});
