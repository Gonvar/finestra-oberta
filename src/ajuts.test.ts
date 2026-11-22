// Files sintètiques amb la forma de les del RAISC a Dades obertes de Catalunya del 22/11/2026. Les
// convocatòries són inventades.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { construirAjuts, CONVOCATORIES, dataIso } from './ajuts.ts';
import { SourceError, type Fetch } from './comun.ts';

const AVUI = '2026-11-22';
const META = {
  name: 'Convocatòries del RAISC',
  attribution: "Departament d'Economia i Finances",
  rowsUpdatedAt: 1795320079,
};

const FINALS = [
  { data_fi_presentaci_sol: '01/12/2026', n: '1' },
  { data_fi_presentaci_sol: '19/10/2026', n: '40' },
  { data_fi_presentaci_sol: '22/11/2026', n: '1' },
  { data_fi_presentaci_sol: '31/01/2030', n: '1' },
  { n: '12' },
];

const VIGENTS = [
  {
    codi_raisc: 'B-26-002',
    t_tol_convocat_ria_catal: 'Ajuts de prova per a entitats',
    entitat_oo_aa_o_departament_1: 'ORGANISME B',
    administraci_: 'Generalitat de Catalunya',
    tipus_de_convocat_ria: 'Subvenció amb concurrència',
    import_total_convocat_ria: '800000',
    data_inici_presentaci_sol: '05/11/2026',
    data_fi_presentaci_sol: '01/12/2026',
    seu_electr_nica: 'https://seu.exemple.cat/b',
  },
  {
    codi_raisc: 'A-26-001',
    t_tol_convocat_ria_catal: 'Beques de prova',
    data_fi_presentaci_sol: '01/12/2026',
  },
  {
    codi_raisc: 'C-26-003',
    t_tol_convocat_ria_catal: 'Premi de prova',
    import_total_convocat_ria: '1500.5',
    data_inici_presentaci_sol: '01/11/2026',
    data_fi_presentaci_sol: '22/11/2026',
  },
];

function font(finals: unknown[], vigents: unknown[]) {
  const urls: string[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(String(input));
    if (url.pathname === `/api/views/${CONVOCATORIES}.json`) return Response.json(META);
    if (url.searchParams.has('$group')) return Response.json(finals);
    return Response.json(vigents);
  };
  return { fetchImpl, urls };
}

test('publica les convocatòries que el dia de la consulta encara no han acabat el termini', async () => {
  const { fetchImpl, urls } = font(FINALS, VIGENTS);
  const ajuts = await construirAjuts(fetchImpl, AVUI);
  // Només es demanen els finals de termini d'avui o més endavant; ni els passats ni els buits.
  assert.equal(
    new URL(urls[2]!).searchParams.get('$where'),
    "data_fi_presentaci_sol in ('01/12/2026', '22/11/2026', '31/01/2030')",
  );
  assert.equal(ajuts.data_dades, '2026-11-22');
  assert.equal(ajuts.url, `https://analisi.transparenciacatalunya.cat/d/${CONVOCATORIES}`);
  assert.deepEqual(
    ajuts.convocatories.map((c) => c.codi_raisc),
    ['C-26-003', 'A-26-001', 'B-26-002'],
  );
  assert.deepEqual(ajuts.convocatories[2], {
    codi_raisc: 'B-26-002',
    codi_bdns: null,
    titol: 'Ajuts de prova per a entitats',
    organisme: 'ORGANISME B',
    administracio: 'Generalitat de Catalunya',
    tipus: 'Subvenció amb concurrència',
    instrument: null,
    finalitat: null,
    beneficiaris: null,
    import_total: 800000,
    inici: '2026-11-05',
    fi: '2026-12-01',
    inici_font: '05/11/2026',
    fi_font: '01/12/2026',
    seu_electronica: 'https://seu.exemple.cat/b',
    bases_reguladores: null,
  });
  // Totes tenen els mateixos camps, encara que la font no els doni.
  const camps = Object.keys(ajuts.convocatories[2]!);
  for (const c of ajuts.convocatories) assert.deepEqual(Object.keys(c), camps);
  assert.equal(ajuts.convocatories[1]!.inici, null);
  assert.equal(ajuts.convocatories[0]!.import_total, 1500.5);
});

test('si cap termini és vigent, no fa la segona consulta i publica una llista buida', async () => {
  const { fetchImpl, urls } = font([{ data_fi_presentaci_sol: '19/10/2026', n: '3' }], []);
  const ajuts = await construirAjuts(fetchImpl, AVUI);
  assert.equal(urls.length, 2);
  assert.deepEqual(ajuts.convocatories, []);
});

test("s'atura si una data de la font no té la forma esperada, encara que sigui antiga", async () => {
  const { fetchImpl } = font([{ data_fi_presentaci_sol: '2019-10-19', n: '1' }], []);
  await assert.rejects(construirAjuts(fetchImpl, AVUI), SourceError);
});

test("s'atura si una convocatòria surt dues vegades o la font és buida", async () => {
  const doble = font(FINALS, [VIGENTS[0], VIGENTS[0]]);
  await assert.rejects(construirAjuts(doble.fetchImpl, AVUI), /surt dues vegades/);
  const buida = font([], []);
  await assert.rejects(construirAjuts(buida.fetchImpl, AVUI), /cap convocatòria/);
});

test('dataIso rebutja les dates que no existeixen', () => {
  assert.equal(dataIso('29/02/2028'), '2028-02-29');
  assert.throws(() => dataIso('31/02/2026'), SourceError);
  assert.throws(() => dataIso('1/2/2026'), SourceError);
});
