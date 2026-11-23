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
    amb_import: '3',
    import: '1500.5',
  },
  {
    subjecte_ambit: "Entitats de l'Administració Local",
    id_agrupacio_organisme: '300',
    agrupacio_organisme: 'Ajuntament C',
    procediment_adjudicacio: 'Menor',
    inscripcions: '10',
    amb_import: '10',
    import: '9000',
  },
  {
    subjecte_ambit: "Entitats de l'Administració Local",
    id_agrupacio_organisme: '300',
    agrupacio_organisme: 'Ajuntament C',
    inscripcions: '1',
    amb_import: '1',
    import: '20',
  },
];

const SITUACIONS = [
  { situaci_contractual: 'adjudicació', subjecte_ambit: 'Universitats', inscripcions: '5' },
  {
    situaci_contractual: 'menor',
    subjecte_ambit: "Entitats de l'Administració Local",
    inscripcions: '9',
  },
  { situaci_contractual: 'liquidació', subjecte_ambit: 'Altres', inscripcions: '4' },
];

/** Per defecte, cada grup de procediment té un sol adjudicatari: les dues agrupacions sumen igual. */
const perAdjudicatari = (grups: unknown[]) =>
  (grups as Record<string, unknown>[]).map(({ procediment_adjudicacio, ...g }) => ({
    ...g,
    adjudicatari: procediment_adjudicacio === undefined ? undefined : `Empresa ${g.inscripcions}`,
  }));

function font({
  grups = GRUPS as unknown[],
  adjudicataris = undefined as unknown[] | undefined,
  situacions = SITUACIONS as unknown[],
  posteriors = [{ inscripcions: '7' }] as unknown[],
  rowsUpdatedAt = META.rowsUpdatedAt,
} = {}) {
  const perAdj = adjudicataris ?? perAdjudicatari(grups);
  const urls: URL[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.pathname === `/api/views/${REGISTRE}.json`)
      return Response.json({ ...META, rowsUpdatedAt });
    const group = url.searchParams.get('$group');
    if (group === 'situaci_contractual, subjecte_ambit') return Response.json(situacions);
    if (group !== null) {
      // Com la font, només torna els grups de l'àmbit que es demana, a partir de $offset.
      const ambit = /subjecte_ambit = '(.*)'$/.exec(url.searchParams.get('$where')!)![1]!;
      const llista = group.endsWith('adjudicatari') ? perAdj : grups;
      const offset = Number(url.searchParams.get('$offset'));
      return Response.json(
        (llista as { subjecte_ambit: string }[])
          .filter((g) => g.subjecte_ambit === ambit.replaceAll("''", "'"))
          .slice(offset, offset + 50_000),
      );
    }
    if (url.searchParams.get('$where')!.endsWith('IS NULL'))
      return Response.json([{ inscripcions: '0' }]);
    return Response.json(posteriors);
  };
  return { fetchImpl, urls };
}

test("publica les adjudicacions d'aquest any per organisme i procediment, fins al dia de les dades", async () => {
  const { fetchImpl, urls } = font();
  const contractes = (await construirContractes(fetchImpl))['contractes.json'];
  // Les situacions es demanen mes a mes, de gener al mes de les dades.
  const mesos = urls.filter(
    (u) => u.searchParams.get('$group') === 'situaci_contractual, subjecte_ambit',
  );
  assert.deepEqual(
    [mesos.length, mesos[0]!.searchParams.get('$where'), mesos[10]!.searchParams.get('$where')],
    [
      11,
      "data_adjudicacio >= '2026-01-01' and data_adjudicacio < '2026-02-01'",
      "data_adjudicacio >= '2026-11-01' and data_adjudicacio < '2026-11-17'",
    ],
  );
  const [, universitats, local, , , posteriors] = urls.filter((u) => !mesos.includes(u));
  // Només adjudicacions i menors, de l'1 de gener a l'última actualització de la font, una consulta
  // per àmbit amb adjudicacions i per agrupació; l'àmbit que només té liquidacions no es demana.
  assert.equal(
    universitats!.searchParams.get('$where'),
    "situaci_contractual in ('adjudicació', 'menor') and data_adjudicacio >= '2026-01-01' and data_adjudicacio < '2026-11-17' and subjecte_ambit = 'Universitats'",
  );
  assert.match(
    local!.searchParams.get('$where')!,
    /subjecte_ambit = 'Entitats de l''Administració Local'$/,
  );
  assert.equal(
    posteriors!.searchParams.get('$where'),
    "situaci_contractual in ('adjudicació', 'menor') and data_adjudicacio >= '2026-11-17'",
  );
  assert.equal(contractes.any, 2026);
  assert.equal(contractes.data_dades, '2026-11-16');
  assert.equal(contractes.adjudicacions_posteriors, 7);
  assert.equal(contractes.adjudicacions_sense_data, 0);
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
  assert.deepEqual(Object.keys(contractes.files[2]!), [
    'ambit',
    'organisme_codi',
    'organisme',
    'procediment',
    'inscripcions',
    'import',
  ]);
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
  const nou = {
    ...GRUPS[0],
    agrupacio_organisme: 'Universitat B nova',
    inscripcions: '1',
    amb_import: '1',
  };
  const { fetchImpl } = font({ grups: [nou, GRUPS[0]] });
  const contractes = (await construirContractes(fetchImpl))['contractes.json'];
  assert.deepEqual(
    contractes.files.map((f) => [f.organisme, f.inscripcions]),
    [
      ['Universitat B', 3],
      ['Universitat B nova', 1],
    ],
  );
  // L'1 de gener a les 10.00 a Catalunya.
  const gener = Date.UTC(2027, 0, 1, 9) / 1000;
  const buida = font({ grups: [], situacions: [], rowsUpdatedAt: gener });
  const primerDia = (await construirContractes(buida.fetchImpl))['contractes.json'];
  assert.equal(primerDia.any, 2027);
  assert.deepEqual(primerDia.files, []);
});

test("s'atura si a mitjan any falta una situació, no hi ha cap fila o un grup té inscripcions sense import", async () => {
  const senseMenors = font({ situacions: [SITUACIONS[0]] });
  await assert.rejects(construirContractes(senseMenors.fetchImpl), /cap inscripció «menor»/);
  const buida = font({ grups: [] });
  await assert.rejects(construirContractes(buida.fetchImpl), /cap adjudicació el 2026/);
  const senseImport = font({ grups: [{ ...GRUPS[0], amb_import: '2' }] });
  await assert.rejects(construirContractes(senseImport.fetchImpl), /sense import/);
});

test('el dia de les dades és el de Catalunya', async () => {
  // El 16/11 a les 23.30 en UTC ja és el 17 a Catalunya.
  const { fetchImpl, urls } = font({ rowsUpdatedAt: Date.UTC(2026, 10, 16, 23, 30) / 1000 });
  const contractes = (await construirContractes(fetchImpl))['contractes.json'];
  assert.equal(contractes.data_dades, '2026-11-17');
  assert.match(urls[11]!.searchParams.get('$where')!, /data_adjudicacio < '2026-11-18'$/);
});

test('publica qui guanya a cada organisme, amb les mateixes inscripcions que per procediment', async () => {
  const sense = { ...GRUPS[0], procediment_adjudicacio: undefined };
  const adjudicataris = [
    { ...sense, adjudicatari: 'Empresa B', inscripcions: '2', amb_import: '2', import: '1000' },
    { ...sense, adjudicatari: 'Empresa A', inscripcions: '1', amb_import: '1', import: '500.5' },
    {
      ...GRUPS[1],
      procediment_adjudicacio: undefined,
      inscripcions: '11',
      amb_import: '11',
      import: '9020',
    },
  ];
  const { fetchImpl, urls } = font({ adjudicataris });
  const fitxers = await construirContractes(fetchImpl);
  const fitxer = fitxers['adjudicataris.json'];
  const perAdj = urls.filter((u) => (u.searchParams.get('$group') ?? '').endsWith('adjudicatari'));
  // L'ordre per tota la clau fa que les pàgines d'un àmbit no es trepitgin.
  assert.equal(perAdj[0]!.searchParams.get('$order'), perAdj[0]!.searchParams.get('$group'));
  // L'adjudicatari que falta és null i va al final del seu organisme.
  assert.deepEqual(
    fitxer.files.map((f) => [f.organisme_codi, f.adjudicatari, f.inscripcions, f.import]),
    [
      ['300', null, 11, 9020],
      ['200', 'Empresa A', 1, 500.5],
      ['200', 'Empresa B', 2, 1000],
    ],
  );
  assert.equal(fitxer.data_dades, fitxers['contractes.json'].data_dades);
  assert.equal(fitxer.adjudicacions_posteriors, 7);
  // Un grup que surt dues vegades vol dir que les pàgines es trepitgen.
  const repetit = font({ adjudicataris: [adjudicataris[0], ...adjudicataris] });
  await assert.rejects(construirContractes(repetit.fetchImpl), (e: Error) => {
    assert.match(e.message, /repeteix un grup de l'organisme/);
    assert.doesNotMatch(e.message, /Empresa/);
    return true;
  });
  // Si les dues agrupacions no sumen el mateix, la font ha canviat entre consultes.
  const menys = font({ adjudicataris: adjudicataris.slice(1) });
  await assert.rejects(
    construirContractes(menys.fetchImpl),
    /14 inscripcions per procediment i 12/,
  );
});

test("llegeix tots els adjudicataris d'un àmbit encara que passin d'una pàgina", async () => {
  const n = 50_001;
  const grups = [
    { ...GRUPS[0], inscripcions: String(n), amb_import: String(n), import: String(n) },
  ];
  const adjudicataris = Array.from({ length: n }, (_, i) => ({
    ...GRUPS[0],
    procediment_adjudicacio: undefined,
    adjudicatari: `Empresa ${String(i).padStart(5, '0')}`,
    inscripcions: '1',
    amb_import: '1',
    import: '1',
  }));
  const { fetchImpl, urls } = font({ grups, adjudicataris });
  const fitxer = (await construirContractes(fetchImpl))['adjudicataris.json'];
  assert.deepEqual(
    urls
      .filter((u) => (u.searchParams.get('$group') ?? '').endsWith('adjudicatari'))
      .map((u) => u.searchParams.get('$offset')),
    // L'àmbit local també es demana, perquè hi ha menors, i no té cap grup.
    ['0', '50000', '0'],
  );
  assert.equal(fitxer.files.length, n);
});
