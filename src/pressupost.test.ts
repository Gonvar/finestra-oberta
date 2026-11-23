// Files sintètiques amb la forma de les de l'execució mensual del pressupost a Dades obertes de
// Catalunya del 23/11/2026. Les entitats, les seccions i els imports són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { construirPressupost, DESPESES, INGRESSOS } from './pressupost.ts';

const META = {
  name: 'Execució mensual',
  attribution: "Departament d'Economia i Finances",
  rowsUpdatedAt: 1795002858,
};

const SECCIONS = [
  {
    entitat_codi: '1000',
    entitat: 'Entitat A',
    ordre_protocol_secci: '02',
    secci_codi: 'SB',
    secci: 'Secció B',
    inicial: '100.50',
    definitiu: '120',
    reconegut: '80.25',
    pagat: '-1.5',
  },
  {
    entitat_codi: '1000',
    entitat: 'Entitat A',
    ordre_protocol_secci: '01',
    secci_codi: 'SA',
    secci: 'Secció A',
    inicial: '10',
    definitiu: '10',
    reconegut: '0',
    pagat: '0',
  },
];

const CAPITOLS = [
  {
    entitat_codi: '1000',
    entitat: 'Entitat A',
    cap_tol_codi: '1',
    cap_tol: 'Impostos directes',
    inicial: '500',
    finals: '510',
    reconegut: '400.10',
    recaptat: '390',
  },
];

function font({
  periode = { exercici: '2026', mes: '10 Octubre' },
  seccions = SECCIONS as unknown[],
  capitols = CAPITOLS as unknown[],
} = {}) {
  const urls: URL[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.pathname.startsWith('/api/views/')) return Response.json(META);
    if (url.searchParams.get('$limit') === '1') return Response.json([periode]);
    if (url.pathname === `/resource/${DESPESES}.json`) return Response.json(seccions);
    if (url.pathname === `/resource/${INGRESSOS}.json`) return Response.json(capitols);
    throw new Error(`URL inesperada: ${url}`);
  };
  return { fetchImpl, urls };
}

test("publica les despeses per secció i els ingressos per capítol de l'últim mes", async () => {
  const { fetchImpl, urls } = font();
  const pressupost = await construirPressupost(fetchImpl);
  // Les sumes es demanen a l'API, només de l'últim mes.
  const despeses = urls.find(
    (u) =>
      u.pathname === `/resource/${DESPESES}.json` &&
      u.searchParams.has('$group') &&
      u.searchParams.get('$limit') !== '1',
  )!;
  assert.equal(despeses.searchParams.get('$where'), "exercici = 2026 and mes = '10 Octubre'");
  assert.match(despeses.searchParams.get('$select')!, /sum\(obligacions_reconegudes\)/);
  assert.equal(pressupost.despeses.exercici, 2026);
  assert.equal(pressupost.despeses.mes, '10 Octubre');
  // L'ordre de protocol mana sobre l'ordre en què arriben les files.
  assert.deepEqual(
    pressupost.despeses.seccions.map((s) => s.seccio_codi),
    ['SA', 'SB'],
  );
  assert.deepEqual(pressupost.despeses.seccions[1], {
    entitat_codi: '1000',
    entitat: 'Entitat A',
    seccio_codi: 'SB',
    seccio: 'Secció B',
    ordre_protocol: '02',
    credit_inicial: 100.5,
    pressupost_definitiu: 120,
    obligacions_reconegudes: 80.25,
    obligacions_pagades: -1.5,
  });
  assert.deepEqual(pressupost.ingressos.capitols[0], {
    entitat_codi: '1000',
    entitat: 'Entitat A',
    capitol_codi: '1',
    capitol: 'Impostos directes',
    previsio_inicial: 500,
    previsio_final: 510,
    drets_reconeguts_nets: 400.1,
    recaptacio_neta: 390,
  });
  assert.equal(pressupost.data_despeses, '2026-11-18');
  assert.equal(
    pressupost.url_ingressos,
    `https://analisi.transparenciacatalunya.cat/d/${INGRESSOS}`,
  );
});

test("s'atura si el període no té la forma esperada", async () => {
  const { fetchImpl } = font({ periode: { exercici: '2026', mes: "10' or 1=1" } });
  await assert.rejects(construirPressupost(fetchImpl), /Període inesperat/);
});

test("s'atura si un import no és un nombre o falta un camp", async () => {
  const malament = font({ seccions: [{ ...SECCIONS[0], pagat: '1,5' }] });
  await assert.rejects(construirPressupost(malament.fetchImpl), /no és un import/);
  const sense = font({ capitols: [{ ...CAPITOLS[0], cap_tol_codi: undefined }] });
  await assert.rejects(construirPressupost(sense.fetchImpl), /no té cap_tol_codi/);
});

test("s'atura si una entitat i una secció surten dues vegades, o si la consulta és buida", async () => {
  const doble = font({ seccions: [SECCIONS[0], SECCIONS[0]] });
  await assert.rejects(construirPressupost(doble.fetchImpl), /repeteix 1000\/SB/);
  const buida = font({ capitols: [] });
  await assert.rejects(construirPressupost(buida.fetchImpl), /no té cap fila/);
});

test("ordena per l'ordre de protocol i el capítol com a nombres, i s'atura si no ho són", async () => {
  const deu = { ...SECCIONS[0], ordre_protocol_secci: '10', secci_codi: 'SC' };
  const dos = { ...SECCIONS[1], ordre_protocol_secci: '2' };
  const capitol10 = { ...CAPITOLS[0], cap_tol_codi: '10', cap_tol: 'Capítol deu' };
  const { fetchImpl } = font({ seccions: [deu, dos], capitols: [capitol10, CAPITOLS[0]] });
  const pressupost = await construirPressupost(fetchImpl);
  assert.deepEqual(
    pressupost.despeses.seccions.map((s) => s.ordre_protocol),
    ['2', '10'],
  );
  assert.deepEqual(
    pressupost.ingressos.capitols.map((c) => c.capitol_codi),
    ['1', '10'],
  );
  const lletra = font({ seccions: [{ ...SECCIONS[0], ordre_protocol_secci: 'A' }] });
  await assert.rejects(construirPressupost(lletra.fetchImpl), /no és un nombre/);
});

test("l'ordre de protocol i el nom del capítol poden faltar, i les seccions sense ordre van al final", async () => {
  const sense = { ...SECCIONS[1], ordre_protocol_secci: undefined, secci_codi: 'S0' };
  const { fetchImpl } = font({
    seccions: [sense, SECCIONS[0]],
    capitols: [{ ...CAPITOLS[0], cap_tol: undefined }],
  });
  const pressupost = await construirPressupost(fetchImpl);
  assert.deepEqual(
    pressupost.despeses.seccions.map((s) => [s.seccio_codi, s.ordre_protocol]),
    [
      ['SB', '02'],
      ['S0', null],
    ],
  );
  assert.equal(pressupost.ingressos.capitols[0]!.capitol, null);
});
