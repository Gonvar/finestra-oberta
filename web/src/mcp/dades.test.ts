// Dades sintètiques amb la forma dels fitxers de la branca dades, no captures reals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SourceError } from '../../../src/comun.ts';
import {
  signats,
  cataleg,
  consulta,
  creaDades,
  fonts,
  MAX_CARACTERS,
  segueix,
  trossos,
  type Procedencia,
  type Valor,
} from './dades.ts';

const govern = {
  font: 'Dades obertes de Catalunya: Relació d’alts càrrecs',
  url: 'https://analisi.transparenciacatalunya.cat/d/x9au-abcn',
  data_dades: '2026-09-29',
  nota: 'Una nota.',
  president: { nom: 'Persona U', carrec: 'President de la Generalitat' },
  consellers: [
    { nom: 'Persona Dos', departament: 'Departament de Salut' },
    { nom: 'Persona Tres', departament: 'Departament d’Educació', foto: null },
    { nom: 'Persona Quatre', departament: 'Departament de Cultura' },
  ],
};
const agenda = {
  govern: {
    font: 'Actes del Govern',
    url: 'https://analisi.transparenciacatalunya.cat/d/wf87-e34n',
    data_dades: '2026-11-23',
    des_de: '2026-10-01',
  },
  parlament: { font: 'Agenda parlamentària', data_consulta: '2026-11-23' },
};
const procedencia = {
  grups: {
    govern: { data_consulta: '2026-11-23', fitxers: { 'govern.json': 'a'.repeat(64) } },
    agenda: { data_consulta: '2026-11-22', fitxers: { 'agenda.json': 'b'.repeat(64) } },
  },
};
const publicats: Record<string, unknown> = { 'govern.json': govern, 'agenda.json': agenda };

/** Els fitxers que el build genera per al servidor: /conjunts.json i els trossos de /conjunts/. */
function web(procedencia: Procedencia, publicats: Record<string, unknown>) {
  const fitxers: Record<string, unknown> = {
    'conjunts.json': cataleg(procedencia, (fitxer) => publicats[fitxer] as Valor),
  };
  for (const { fitxer, sha256, data_consulta } of signats(procedencia))
    for (const [cami, tros] of Object.entries(
      trossos(fitxer.replace(/\.json$/, ''), sha256, publicats[fitxer] as Valor, data_consulta),
    ))
      fitxers[`conjunts/${cami}`] = tros;
  return fitxers;
}

function fals(fitxers = web(procedencia, publicats)) {
  const llegits: string[] = [];
  const dades = creaDades(async (fitxer) => {
    llegits.push(fitxer);
    if (!(fitxer in fitxers)) throw new Error(`no hi és: ${fitxer}`);
    return JSON.stringify(fitxers[fitxer]);
  });
  return { dades, llegits };
}

test('cada conjunt diu la font, la data, la nota i com verificar-lo, tal com els escriu el fitxer', async () => {
  const { dades } = fals();
  const { conjunts } = await dades.llistar();
  // Cada conjunt porta el dia de la seva font, que pot ser d'abans si la font no va respondre.
  assert.deepEqual(
    conjunts.map((c) => [c.conjunt, c.data_consulta]),
    [
      ['govern', '2026-11-23'],
      ['agenda', '2026-11-22'],
    ],
  );
  assert.deepEqual(conjunts[0]!.fonts, {
    font: govern.font,
    url: govern.url,
    data_dades: '2026-09-29',
    nota: 'Una nota.',
  });
  // Les fonts d'un fitxer amb blocs, com agenda.json, es llegeixen dins de cada bloc.
  assert.deepEqual(conjunts[1]!.fonts, {
    govern: { font: 'Actes del Govern', url: agenda.govern.url, data_dades: '2026-11-23' },
    parlament: { font: 'Agenda parlamentària', data_consulta: '2026-11-23' },
  });
  assert.deepEqual(conjunts[0]!.verificacio, {
    fitxer: 'https://raw.githubusercontent.com/Gonvar/finestra-oberta/dades/govern.json',
    sha256: 'a'.repeat(64),
    procedencia: 'https://raw.githubusercontent.com/Gonvar/finestra-oberta/dades/procedencia.json',
    com_verificar:
      'https://github.com/Gonvar/finestra-oberta/blob/main/docs/institucions.md#com-comprovar-que-les-dades-s%C3%B3n-de-la-font',
  });
});

test('la procedència d’abans, sense grups, es llegeix com un sol grup', () => {
  assert.deepEqual(signats({ data_consulta: '2026-11-21', fitxers: { 'govern.json': 'a' } }), [
    { fitxer: 'govern.json', sha256: 'a', data_consulta: '2026-11-21' },
  ]);
});

test('un fitxer sense font és un error, no un conjunt sense font', () => {
  assert.throws(() => fonts({ persones: [] }), SourceError);
});

test('només hi ha els conjunts que signa procedencia.json', async () => {
  const { dades, llegits } = fals();
  await assert.rejects(dades.consulta('procedencia', { cami: '', desde: 0, quants: 20 }), {
    message: /No hi ha cap conjunt «procedencia». Els conjunts són: govern, agenda\./,
  });
  assert.deepEqual(llegits, ['conjunts.json']);
});

test('llegeix cada fitxer un sol cop, i torna a provar el que ha fallat', async () => {
  const { dades, llegits } = fals();
  await dades.estructura('govern', '');
  await dades.consulta('govern', { cami: 'president', desde: 0, quants: 20 });
  await dades.consulta('govern', { cami: 'president.nom', desde: 0, quants: 20 });
  assert.deepEqual(llegits, [
    'conjunts.json',
    'conjunts/govern.json',
    'conjunts/govern/president.json',
  ]);

  let falla = true;
  const fitxers = web(procedencia, publicats);
  const fragil = creaDades(async (fitxer) => {
    if (falla) throw new Error('la web no respon');
    return JSON.stringify(fitxers[fitxer]);
  });
  await assert.rejects(fragil.llistar(), /la web no respon/);
  falla = false;
  assert.equal((await fragil.llistar()).conjunts.length, 2);
});

test('segueix un camí per camps i per números de llista', () => {
  assert.equal(segueix(govern as Valor, 'consellers.1.departament'), 'Departament d’Educació');
  assert.equal(segueix(govern as Valor, 'consellers.1.foto'), null);
  assert.throws(() => segueix(govern as Valor, 'consellers.3'), {
    message: 'consellers és una llista de 3 elements: «3» no hi és. Fes servir un número de 0 a 2.',
  });
  assert.throws(() => segueix(govern as Valor, 'consellers.u'), SourceError);
  assert.throws(() => segueix(govern as Valor, 'ministres'), {
    message:
      /«ministres» no és un camp del fitxer\. Els camps són: font, url, data_dades, nota, president, consellers\./,
  });
  assert.throws(() => segueix(govern as Valor, 'nota.x'), {
    message: 'nota és un valor, i no té camps.',
  });
  // Un camp heretat no és un camp del fitxer.
  assert.throws(() => segueix(govern as Valor, 'president.constructor'), SourceError);
});

test("una llista es torna per pàgines, en l'ordre de la font i amb l'índex de cada element", () => {
  const resultat = consulta(govern as Valor, { cami: 'consellers', desde: 1, quants: 1 });
  assert.deepEqual(resultat, {
    elements: 3,
    desde: 1,
    seguent: 2,
    resultat: [{ index: 1, valor: govern.consellers[1] }],
  });
  assert.equal(
    'seguent' in consulta(govern as Valor, { cami: 'consellers', desde: 2, quants: 1 }),
    false,
  );
});

test('la cerca troba totes les paraules, sense accents ni majúscules, a tot l’element o en un camp', () => {
  const tot = consulta(govern as Valor, {
    cami: 'consellers',
    cerca: 'EDUCACIO persona',
    desde: 0,
    quants: 20,
  });
  assert.deepEqual(tot.resultat, [{ index: 1, valor: govern.consellers[1] }]);
  assert.equal(tot.coincidencies, 1);
  assert.equal(tot.elements, 3);

  const enUnCamp = consulta(govern as Valor, {
    cami: 'consellers',
    cerca: 'salut',
    camp: 'nom',
    desde: 0,
    quants: 20,
  });
  assert.deepEqual(enUnCamp.resultat, []);
  assert.equal(enUnCamp.coincidencies, 0);

  assert.throws(
    () =>
      consulta(govern as Valor, {
        cami: 'consellers',
        cerca: 'salut',
        camp: 'nmo',
        desde: 0,
        quants: 20,
      }),
    /Cap element de consellers no té el camp «nmo»/,
  );
  assert.throws(
    () => consulta(govern as Valor, { cami: 'president', cerca: 'u', desde: 0, quants: 20 }),
    /no és una llista/,
  );
  assert.throws(
    () => consulta(govern as Valor, { cami: 'consellers', camp: 'nom', desde: 0, quants: 20 }),
    /cal també «cerca»/,
  );
});

test('un valor que no és una llista es torna sencer, sense canviar-lo', () => {
  assert.deepEqual(consulta(govern as Valor, { cami: 'president', desde: 0, quants: 20 }), {
    resultat: govern.president,
  });
});

test('una resposta massa gran es mesura tal com arriba a l’assistent, amb el context', async () => {
  // Compacte hi cabria; amb el sagnat que hi posa run, no.
  const element = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`camp${i}`, i]));
  const gran = { font: 'f', files: Array.from({ length: 100 }, () => element) };
  const parametres = { cami: 'files', desde: 0, quants: 100 };
  assert.ok(JSON.stringify(consulta(gran, parametres)).length < MAX_CARACTERS);
  const { dades } = fals(
    web(
      {
        grups: { gran: { data_consulta: '2026-11-23', fitxers: { 'gran.json': 'c'.repeat(64) } } },
      },
      {
        'gran.json': gran,
      },
    ),
  );
  await assert.rejects(dades.consulta('gran', parametres), /el màxim és 60000/);
  const petita = await dades.consulta('gran', { ...parametres, quants: 10 });
  assert.equal((petita as typeof petita & { resultat: Valor[] }).resultat.length, 10);
});

test('les condicions d’ús i els valors null de les fonts arriben a l’assistent', () => {
  assert.deepEqual(
    fonts({
      font: 'ICGC',
      condicions: 'http://www.icgc.cat/condicions',
      parlament: { font: 'Parlament', data_dades: null },
    }),
    {
      font: 'ICGC',
      condicions: 'http://www.icgc.cat/condicions',
      parlament: { font: 'Parlament', data_dades: null },
    },
  );
});

test('un número dins d’una llista buida diu que la llista és buida', () => {
  assert.throws(() => segueix({ font: 'f', files: [] }, 'files.0'), {
    message: 'files és una llista buida.',
  });
});

test('l’estructura diu els camps de tots els elements, sense les dades senceres', async () => {
  const { dades } = fals();
  const { estructura } = await dades.estructura('govern', 'consellers');
  assert.deepEqual(estructura, {
    tipus: 'llista',
    elements: 3,
    tipus_elements: 'objecte',
    camps_dels_elements: { nom: 'text', departament: 'text', foto: 'null' },
  });
  const arrel = await dades.estructura('govern', '');
  assert.deepEqual(arrel.estructura, {
    tipus: 'objecte',
    camps: {
      font: govern.font,
      url: govern.url,
      data_dades: '2026-09-29',
      nota: 'Una nota.',
      president: 'objecte amb 2 camps',
      consellers: 'llista de 3',
    },
  });
});

// Una llista de més de 200 kB, com les de mapa-municipis.json o ajuts.json, que el build parteix.
const municipi = (i: number) => ({
  codi: String(i).padStart(6, '0'),
  nom: i === 7 ? 'Vic' : i === 300 ? 'Sant Vicenç' : `Municipi ${i}`,
  geometria: {
    type: 'MultiPolygon',
    coordinates: [[Array.from({ length: 80 }, () => [1.5, 41.5])]],
  },
});
const mapa = {
  font: 'ICGC',
  data_dades: '2026-01-01',
  municipis: Array.from({ length: 400 }, (_, i) => municipi(i)),
};
const procedenciaMapa = {
  grups: { mapa: { data_consulta: '2026-11-23', fitxers: { 'mapa.json': 'd'.repeat(64) } } },
};
const fitxersMapa = web(procedenciaMapa, { 'mapa.json': mapa });

test('una llista gran es llegeix per pàgines, amb els mateixos valors i índexs que sencera', async () => {
  assert.ok(JSON.stringify(mapa.municipis).length > 200_000);
  const { dades, llegits } = fals(fitxersMapa);
  const parametres = { cami: 'municipis', desde: 250, quants: 3 };
  const { resultat, elements, desde, seguent } = await dades.consulta('mapa', parametres);
  assert.deepEqual({ elements, desde, seguent, resultat }, consulta(mapa as Valor, parametres));
  assert.equal(
    (await dades.consulta('mapa', { cami: 'municipis.300.nom', desde: 0, quants: 20 })).resultat,
    'Sant Vicenç',
  );
  // Només les pàgines on són els elements, no tota la llista.
  const pagines = llegits.filter((f) => /municipis\/\d+\.json$/.test(f));
  assert.ok(pagines.length >= 1 && pagines.length <= 3, pagines.join(', '));
  assert.ok(Object.keys(fitxersMapa).filter((f) => /municipis\/\d+\.json$/.test(f)).length > 3);
});

test('en una llista gran es cerca en un camp, i la cerca dona el que donaria la llista sencera', async () => {
  const { dades } = fals(fitxersMapa);
  const parametres = { cami: 'municipis', cerca: 'vic', camp: 'nom', desde: 0, quants: 20 };
  const resposta = await dades.consulta('mapa', parametres);
  const { resultat, coincidencies } = consulta(mapa as Valor, parametres);
  assert.deepEqual(resposta.resultat, resultat);
  assert.equal(resposta.coincidencies, coincidencies);
  assert.equal(coincidencies, 2);
  await assert.rejects(dades.consulta('mapa', { ...parametres, camp: undefined }), {
    message:
      /municipis té 400 elements: per cercar-hi, digues en quin camp amb «camp». Es pot cercar en: codi, nom\./,
  });
});

test('una llista gran no es llegeix si la resposta no hi cabria', async () => {
  const { dades, llegits } = fals(fitxersMapa);
  await assert.rejects(
    dades.consulta('mapa', { cami: 'municipis', desde: 0, quants: 100 }),
    /La resposta té més de \d+ caràcters i el màxim és 60000/,
  );
  await assert.rejects(
    dades.consulta('mapa', { cami: '', desde: 0, quants: 20 }),
    /el màxim és 60000/,
  );
  await assert.rejects(dades.consulta('mapa', { cami: '', cerca: 'vic', desde: 0, quants: 20 }), {
    message: "El fitxer no és una llista: la cerca no s'hi aplica.",
  });
  assert.equal(llegits.filter((f) => /municipis\/\d+\.json$/.test(f)).length, 0);
});

test('l’estructura d’una llista gran surt del build, i la data de consulta acompanya el conjunt', async () => {
  const { dades } = fals(fitxersMapa);
  const { estructura, data_consulta } = await dades.estructura('mapa', 'municipis');
  assert.deepEqual(estructura, {
    tipus: 'llista',
    elements: 400,
    tipus_elements: 'objecte',
    camps_dels_elements: { codi: 'text', nom: 'text', geometria: 'objecte' },
  });
  assert.equal(data_consulta, '2026-11-23');
  await assert.rejects(dades.estructura('mapa', 'municipis.400'), /de 0 a 399/);
});
