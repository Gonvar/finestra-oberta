// Pàgines i files sintètiques amb la forma de les del Parlament i de Dades obertes del 22/11/2026.
// Els noms són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import {
  ALTS_CARRECS,
  construirGovern,
  construirParlament,
  ESCONS,
  fitxaUrl,
  INTERVENCIONS,
  llegirFitxa,
  llegirMapa,
  MAPA_ESCONS,
} from './institucions.ts';

const GRUP_A = 'Grup Parlamentari A';
const GRUP_B = 'Grup Parlamentari B';
const SUBGRUP_B = 'Subgrup Parlamentari B Dos';

const esco = (codi: number, seient: number, grup: string, color = '#aaa') =>
  `afegirEsco(midaEsco, "${color}", "${String(seient).padStart(3, '0')}", "Sr. Persona ${codi}", "Diputat", "", "https://www.parlament.cat/apl/gimg/imatgeweb?p_mida=B&p_id=1 ", "${grup}", "/web/composicio/diputats-fitxa/index.html?p_codi=${codi}");`;

/** Un mapa de 135 escons: 133 del grup A i 2 del grup B, un dels quals és al subgrup. */
function mapa({ persones = ESCONS, extra = '' } = {}) {
  const crides = [
    'afegirLlegenda("#aaa", "GP A");',
    'afegirLlegenda("#bbb", "GP B");',
    'afegirLlegenda("#ccc", "No Adscrits");',
  ];
  for (let i = 1; i <= persones; i++) {
    if (i === 1) crides.push(esco(i, i, GRUP_B, '#bbb'));
    else if (i === 2) crides.push(esco(i, i, GRUP_B, '#bbb'), esco(i, i, SUBGRUP_B, '#bbb'));
    else crides.push(esco(i, i, GRUP_A));
  }
  // El mapa repeteix escons per a cada mida.
  crides.push(esco(3, 3, GRUP_A));
  return `<script>window.onload = function() { ${crides.join(' ')} ${extra} }</script>`;
}

const fitxa = ({
  nom = 'Persona Exemple',
  circumscripcio = 'Circumscripció electoral de Lleida',
  grup = '',
  legislatura = true,
} = {}) =>
  `<h1 class="titol_pagina"><span>Sr. ${nom}</span></h1><img src="x" alt="Fotografia de ${nom}" class="foto_fitxa" ><dl><dt>Llista Electoral: </dt><dd>Llista d&#039;Exemple&nbsp;</dd><dt>Circumscripció: </dt><dd>${circumscripcio}&nbsp;</dd><dt>Partit Polític: </dt><dd>Partit Exemple&nbsp;</dd>${grup && `<dt>Grup parlamentari: </dt><dd><a href="#">${grup}</a> . Membre. Alta: 18.06.2024, BOPC, 3.</dd>`}</dl>${legislatura ? '<dl><dt>Membre de la legislatura: </dt><dd><p><a href="#">XV (2024-actualitat)</a>, <a href="#">XIV (2021-2024)</a>, </p></dd></dl>' : ''}`;

/** Un `fetch` que respon segons la URL. */
function fake(respon: (url: string) => string | object) {
  const fetchImpl: Fetch = async (input) => {
    const body = respon(String(input));
    return typeof body === 'string' ? new Response(body) : Response.json(body);
  };
  return fetchImpl;
}

test('el mapa dona un escó per persona, amb el grup i el subgrup', () => {
  const escons = llegirMapa(mapa());
  assert.equal(escons.length, ESCONS);
  assert.deepEqual(escons[0], {
    codi: '1',
    esco: 1,
    carrec: 'Diputat',
    grup: GRUP_B,
    sigla: 'GP B',
  });
  assert.deepEqual(escons[1], {
    codi: '2',
    esco: 2,
    carrec: 'Diputat',
    grup: GRUP_B,
    subgrup: SUBGRUP_B,
    sigla: 'GP B',
  });
});

test('el mapa falla si no hi ha 135 persones', () => {
  assert.throws(() => llegirMapa(mapa({ persones: 134 })), /134 persones/);
});

test('el mapa falla si les còpies d’un escó no coincideixen', () => {
  assert.throws(() => llegirMapa(mapa({ extra: esco(5, 99, GRUP_A) })), /dades diferents/);
});

test('el mapa falla si una persona té dos grups', () => {
  assert.throws(() => llegirMapa(mapa({ extra: esco(5, 5, GRUP_B) })), /un sol grup/);
});

test('el mapa falla si un color no és a la llegenda', () => {
  const html = mapa().replace('afegirLlegenda("#aaa", "GP A");', '');
  assert.throws(() => llegirMapa(html), /llegenda/);
});

test('la fitxa dona el nom, la circumscripció, la llista, el grup i la legislatura', () => {
  assert.deepEqual(llegirFitxa(fitxa({ grup: GRUP_A }), 'u'), {
    nom: 'Persona Exemple',
    circumscripcio: 'Lleida',
    llista_electoral: "Llista d'Exemple",
    partit: 'Partit Exemple',
    grup: GRUP_A,
    legislatura: { numero: 'XV', inici: 2024 },
  });
});

test('la fitxa falla si no hi ha circumscripció', () => {
  const html = fitxa().replace(/<dt>Circumscripció: <\/dt><dd>[^<]*<\/dd>/, '');
  assert.throws(() => llegirFitxa(html, 'u'), /circumscripció/);
});

test('la fitxa falla amb caràcters mal codificats', () => {
  assert.throws(() => llegirFitxa(fitxa({ nom: 'Persona Ex�mple' }), 'u'), /mal codificats/);
});

test('el Parlament suma els escons per grup i subgrup', async () => {
  const fetchImpl = fake((url) =>
    url === MAPA_ESCONS ? mapa() : fitxa({ legislatura: url === fitxaUrl('3') }),
  );
  const parlament = await construirParlament(fetchImpl, '2026-11-22', 0);
  assert.equal(parlament.data_consulta, '2026-11-22');
  assert.deepEqual(parlament.legislatura, { numero: 'XV', inici: 2024 });
  assert.deepEqual(parlament.grups, [
    { nom: GRUP_A, sigla: 'GP A', escons: 133 },
    { nom: GRUP_B, sigla: 'GP B', escons: 2, subgrups: [{ nom: SUBGRUP_B, escons: 1 }] },
  ]);
  assert.equal(parlament.diputats.length, ESCONS);
  assert.equal(parlament.diputats[1]!.subgrup, SUBGRUP_B);
});

test('el Parlament falla si la fitxa i el mapa no donen el mateix grup', async () => {
  const fetchImpl = fake((url) => (url === MAPA_ESCONS ? mapa() : fitxa({ grup: GRUP_B })));
  await assert.rejects(construirParlament(fetchImpl, '2026-11-22', 0), /la fitxa .* diu/i);
});

test('el Parlament falla si cap fitxa dona la legislatura en curs', async () => {
  const fetchImpl = fake((url) => (url === MAPA_ESCONS ? mapa() : fitxa({ legislatura: false })));
  await assert.rejects(construirParlament(fetchImpl, '2026-11-22', 0), /0 legislatures/);
});

const fila = (
  cognoms_nom: string,
  denominacio_lloc: string,
  departament: string,
  sexe = 'Dona',
) => ({ cognoms_nom, sexe, denominacio_lloc, departament, retribucio_anual_prevista: '1,00 €' });

const PRESIDENCIA = 'Departament de la Presidència';
const SALUT = 'Departament de Salut';

/** Les intervencions escriuen els noms amb accents i amb la «i» entre cognoms. */
const NOMS = [
  { nom: 'Anna Èxemple i U' },
  { nom: 'Berta Exemple Dos' },
  { nom: 'Carla Exemple i Tres' },
  { nom: 'Carles Exemple Tres' },
];

function govern(files: object[], noms = NOMS) {
  return fake((url) => {
    if (url.includes(`/api/views/${ALTS_CARRECS}`))
      return {
        name: 'Relació d’alts càrrecs',
        rowsUpdatedAt: 1790681702,
        attribution: 'Secretaria',
      };
    if (url.includes(`/api/views/${INTERVENCIONS}`))
      return { name: 'Intervencions', rowsUpdatedAt: 1795208408, attribution: 'Direcció' };
    return url.includes(INTERVENCIONS) ? noms : files;
  });
}

const GOVERN = [
  fila('EXEMPLE U, ANNA', 'PRESIDENT DE LA GENERALITAT DE CATALUNYA', PRESIDENCIA),
  fila('EXEMPLE DOS, BERTA', 'CONSELLER/A DE LA PRESIDÈNCIA', PRESIDENCIA),
  fila('EXEMPLE TRES, CARLA', 'CONSELLER/A  DE SALUT', SALUT),
  fila('EXEMPLE QUATRE, DIANA', 'SECRETARI/ÀRIA GENERAL', SALUT),
  fila('EXEMPLE CINC, EVA', 'PRESIDENT/A DEL CONSELL DE SALUT', SALUT),
];

test('el Govern dona el president i un conseller per departament, amb el nom ben escrit', async () => {
  const resultat = await construirGovern(govern(GOVERN));
  assert.equal(resultat.data_dades, '2026-09-29');
  assert.equal(resultat.data_noms, '2026-11-20');
  assert.deepEqual(resultat.president, {
    nom: 'Anna Èxemple i U',
    carrec: 'Presidenta de la Generalitat',
    departament: PRESIDENCIA,
    nom_oficial: 'EXEMPLE U, ANNA',
    carrec_oficial: 'PRESIDENT DE LA GENERALITAT DE CATALUNYA',
  });
  assert.deepEqual(
    resultat.consellers.map((c) => [c.nom, c.carrec]),
    [
      ['Berta Exemple Dos', 'Consellera de la Presidència'],
      ['Carla Exemple i Tres', 'Consellera de Salut'],
    ],
  );
});

test('el Govern falla si un nom no és a les intervencions', async () => {
  const noms = NOMS.filter((n) => n.nom !== 'Berta Exemple Dos');
  await assert.rejects(construirGovern(govern(GOVERN, noms)), /coincideix amb 0 noms/);
});

test('el Govern falla si un nom coincideix amb dues persones', async () => {
  const noms = [...NOMS, { nom: 'Berta Maria Exemple Dos' }];
  await assert.rejects(construirGovern(govern(GOVERN, noms)), /coincideix amb 2 noms/);
});

test('el Govern falla si un departament no té conseller', async () => {
  const files = GOVERN.filter((f) => f.cognoms_nom !== 'EXEMPLE TRES, CARLA');
  await assert.rejects(construirGovern(govern(files)), /Salut té 0 consellers/);
});

test('el Govern falla si no hi ha president', async () => {
  const files = GOVERN.filter((f) => f.cognoms_nom !== 'EXEMPLE U, ANNA');
  await assert.rejects(construirGovern(govern(files)), /0 presidents/);
});
