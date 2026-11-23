// Files sintètiques amb la forma de les del Registre públic de contractes a Dades obertes de
// Catalunya del 23/11/2026. Els organismes i els imports són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { construirContractes, REGISTRE } from './contractes.ts';

const META = {
  name: 'Registre públic de contractes',
  attribution: "Departament d'Economia i Finances",
  rowsUpdatedAt: 1794787200,
};

const GRUPS = [
  {
    subjecte_ambit: 'Universitats',
    id_agrupacio_organisme: '200',
    agrupacio_organisme: 'Universitat B',
    procediment_adjudicacio: 'Obert',
    inscripcions: '3',
    import: '1500.5',
  },
  {
    subjecte_ambit: "Entitats de l'Administració Local",
    id_agrupacio_organisme: '300',
    agrupacio_organisme: 'Ajuntament C',
    procediment_adjudicacio: 'Menor',
    inscripcions: '10',
    import: '9000',
  },
  {
    subjecte_ambit: "Entitats de l'Administració Local",
    id_agrupacio_organisme: '300',
    agrupacio_organisme: 'Ajuntament C',
    inscripcions: '1',
    import: '20',
  },
];

function font({
  grups = GRUPS as unknown[],
  posteriors = [{ inscripcions: '7' }] as unknown[],
} = {}) {
  const urls: URL[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.pathname === `/api/views/${REGISTRE}.json`) return Response.json(META);
    if (url.searchParams.has('$group')) return Response.json(grups);
    return Response.json(posteriors);
  };
  return { fetchImpl, urls };
}

test("publica les adjudicacions d'aquest any per organisme i procediment, fins al dia de les dades", async () => {
  const { fetchImpl, urls } = font();
  const contractes = await construirContractes(fetchImpl);
  const [, grups, posteriors] = urls;
  // Només adjudicacions i menors, de l'1 de gener a l'última actualització de la font.
  assert.equal(
    grups!.searchParams.get('$where'),
    "situaci_contractual in ('adjudicació', 'menor') and data_adjudicacio >= '2026-01-01' and data_adjudicacio <= '2026-11-16'",
  );
  assert.equal(
    posteriors!.searchParams.get('$where'),
    "situaci_contractual in ('adjudicació', 'menor') and data_adjudicacio > '2026-11-16'",
  );
  assert.equal(contractes.any, 2026);
  assert.equal(contractes.data_dades, '2026-11-16');
  assert.equal(contractes.adjudicacions_posteriors, 7);
  assert.equal(contractes.url, `https://analisi.transparenciacatalunya.cat/d/${REGISTRE}`);
  // Per àmbit, codi i procediment; el procediment que falta és null i va al final.
  assert.deepEqual(
    contractes.files.map((f) => [f.organisme_codi, f.procediment]),
    [
      ['300', 'Menor'],
      ['300', null],
      ['200', 'Obert'],
    ],
  );
  assert.deepEqual(contractes.files[2], {
    ambit: 'Universitats',
    organisme_codi: '200',
    organisme: 'Universitat B',
    procediment: 'Obert',
    inscripcions: 3,
    import: 1500.5,
  });
});

test("s'atura si un recompte o un import no és un nombre, o si falta l'organisme", async () => {
  const recompte = font({ grups: [{ ...GRUPS[0], inscripcions: '3,0' }] });
  await assert.rejects(construirContractes(recompte.fetchImpl), /no és un nombre/);
  const import_ = font({ grups: [{ ...GRUPS[0], import: '1.500,5' }] });
  await assert.rejects(construirContractes(import_.fetchImpl), /no és un import/);
  const sense = font({ grups: [{ ...GRUPS[0], agrupacio_organisme: undefined }] });
  await assert.rejects(construirContractes(sense.fetchImpl), /no té agrupacio_organisme/);
  const sensePosteriors = font({ posteriors: [] });
  await assert.rejects(construirContractes(sensePosteriors.fetchImpl), /recompte/);
});

test('un organisme que canvia de nom surt amb cada nom, i un any sense adjudicacions és buit', async () => {
  const nou = { ...GRUPS[0], agrupacio_organisme: 'Universitat B nova', inscripcions: '1' };
  const { fetchImpl } = font({ grups: [nou, GRUPS[0]] });
  const contractes = await construirContractes(fetchImpl);
  assert.deepEqual(
    contractes.files.map((f) => [f.organisme, f.inscripcions]),
    [
      ['Universitat B', 3],
      ['Universitat B nova', 1],
    ],
  );
  const buida = font({ grups: [] });
  assert.deepEqual((await construirContractes(buida.fetchImpl)).files, []);
});
