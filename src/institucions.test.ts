// Pàgines i files sintètiques amb la forma de les del Parlament i de Dades obertes del 22/11/2026.
// Els noms són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import {
  AGENDA,
  ALTS_CARRECS,
  construirGovern,
  construirParlament,
  construirTransparencia,
  DECLARACIONS,
  euros,
  ESCONS,
  fitxaUrl,
  INTERVENCIONS,
  llegirFitxa,
  llegirMapa,
  MAPA_ESCONS,
  POSICIONS_ESCONS,
  llegirPosicions,
  llegirPerfils,
  type PerfilsDesats,
  VIATGES,
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
  foto = '42',
  circumscripcio = 'Circumscripció electoral de Lleida',
  grup = '',
  legislatura = true,
} = {}) =>
  `<h1 class="titol_pagina"><span>Sr. ${nom}</span></h1><img loading="lazy" src="https://www.parlament.cat/apl/gimg/imatgeweb?p_mida=B&p_id=${foto} " alt="Fotografia de ${nom}" class="foto_fitxa" ><dl><dt>Llista Electoral: </dt><dd>Llista d&#039;Exemple&nbsp;</dd><dt>Circumscripció: </dt><dd>${circumscripcio}&nbsp;</dd><dt>Partit Polític: </dt><dd>Partit Exemple&nbsp;</dd>${grup && `<dt>Grup parlamentari: </dt><dd><a href="#">${grup}</a> . Membre. Alta: 18.06.2024, BOPC, 3.</dd>`}</dl>${legislatura ? '<dl><dt>Membre de la legislatura: </dt><dd><p><a href="#">XV (2024-actualitat)</a>, <a href="#">XIV (2021-2024)</a>, </p></dd></dl>' : ''}`;

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
    color: '#bbb',
  });
  assert.deepEqual(escons[1], {
    codi: '2',
    esco: 2,
    carrec: 'Diputat',
    grup: GRUP_B,
    subgrup: SUBGRUP_B,
    sigla: 'GP B',
    color: '#bbb',
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

test('la fitxa dona el nom, la foto, la circumscripció, la llista, el grup i la legislatura', () => {
  assert.deepEqual(llegirFitxa(fitxa({ grup: GRUP_A }), 'u'), {
    nom: 'Persona Exemple',
    foto: 'https://www.parlament.cat/apl/gimg/imatgeweb?p_mida=M&p_id=42',
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

test('la fitxa sense foto dona el nom i cap foto', () => {
  const html = fitxa().replace(/src="[^"]*"/, 'src="/img/sense-foto.png"');
  const resultat = llegirFitxa(html, 'u');
  assert.equal(resultat.nom, 'Persona Exemple');
  assert.equal('foto' in resultat, false);
});

test('la fitxa llegeix la foto encara que l’URL escrigui &amp;', () => {
  const html = fitxa().replace('&p_id=', '&amp;p_id=');
  assert.equal(
    llegirFitxa(html, 'u').foto,
    'https://www.parlament.cat/apl/gimg/imatgeweb?p_mida=M&p_id=42',
  );
});

test('la fitxa falla amb caràcters mal codificats', () => {
  assert.throws(() => llegirFitxa(fitxa({ nom: 'Persona Ex�mple' }), 'u'), /mal codificats/);
});

const posicions = (escons = 150) =>
  Array.from(
    { length: escons },
    (_, i) => `posicionsEscons["${String(i + 1).padStart(3, '0')}"] = {x:${i}, y:${2 * i}};`,
  ).join('\n');

test('les posicions dels escons surten del dibuix del mapa', () => {
  assert.deepEqual(llegirPosicions(posicions(2)).get(2), { x: 1, y: 2 });
  assert.throws(() => llegirPosicions('var x = 1;'), /cap escó/);
});

test('el Parlament falla si un escó no té posició al mapa', async () => {
  const fetchImpl = fake((url) =>
    url === POSICIONS_ESCONS
      ? posicions(10)
      : url === MAPA_ESCONS
        ? mapa()
        : fitxa({ legislatura: url === fitxaUrl('3'), foto: url.split('=')[1]! }),
  );
  await assert.rejects(construirParlament(fetchImpl, '2026-11-22', 0), /no dona la posició/);
});

test('el Parlament suma els escons per grup i subgrup', async () => {
  const fetchImpl = fake((url) =>
    url === POSICIONS_ESCONS
      ? posicions()
      : url === MAPA_ESCONS
        ? mapa()
        : fitxa({ legislatura: url === fitxaUrl('3'), foto: url.split('=')[1]! }),
  );
  const parlament = await construirParlament(fetchImpl, '2026-11-22', 0);
  assert.match(parlament.fotos, /Foto: Parlament de Catalunya/);
  assert.equal(
    parlament.diputats[0]!.foto,
    'https://www.parlament.cat/apl/gimg/imatgeweb?p_mida=M&p_id=1',
  );
  assert.equal(parlament.data_consulta, '2026-11-22');
  assert.deepEqual(parlament.legislatura, { numero: 'XV', inici: 2024 });
  assert.deepEqual(parlament.grups, [
    { nom: GRUP_A, sigla: 'GP A', color: '#aaa', escons: 133 },
    {
      nom: GRUP_B,
      sigla: 'GP B',
      color: '#bbb',
      escons: 2,
      subgrups: [{ nom: SUBGRUP_B, escons: 1 }],
    },
  ]);
  assert.equal(parlament.diputats.length, ESCONS);
  assert.equal(parlament.diputats[1]!.subgrup, SUBGRUP_B);
  assert.deepEqual(parlament.diputats[0]!.posicio, { x: 0, y: 0 });
});

test('el Parlament falla si la fitxa i el mapa no donen el mateix grup', async () => {
  const fetchImpl = fake((url) =>
    url === POSICIONS_ESCONS ? posicions() : url === MAPA_ESCONS ? mapa() : fitxa({ grup: GRUP_B }),
  );
  await assert.rejects(construirParlament(fetchImpl, '2026-11-22', 0), /la fitxa .* diu/i);
});

test('el Parlament falla si cap fitxa no dona la foto', async () => {
  const fetchImpl = fake((url) =>
    url === POSICIONS_ESCONS
      ? posicions()
      : url === MAPA_ESCONS
        ? mapa()
        : fitxa({ legislatura: url === fitxaUrl('3') }).replace(/src="[^"]*"/, 'src="x"'),
  );
  await assert.rejects(construirParlament(fetchImpl, '2026-11-22', 0), /Cap fitxa no dona la foto/);
});

test('el Parlament falla si dues fitxes donen la mateixa foto', async () => {
  const fetchImpl = fake((url) =>
    url === POSICIONS_ESCONS
      ? posicions()
      : url === MAPA_ESCONS
        ? mapa()
        : fitxa({ legislatura: url === fitxaUrl('3') }),
  );
  await assert.rejects(construirParlament(fetchImpl, '2026-11-22', 0), /mateixa foto/);
});

test('el Parlament falla si cap fitxa dona la legislatura en curs', async () => {
  const fetchImpl = fake((url) =>
    url === POSICIONS_ESCONS
      ? posicions()
      : url === MAPA_ESCONS
        ? mapa()
        : fitxa({ legislatura: false, foto: url.split('=')[1]! }),
  );
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

const perfil = (nom: string, carrec: string, fotos = 1) => ({
  nom,
  carrec,
  fotos: Array.from({ length: fotos }, (_, i) => `https://govern.cat/govern/docs/${nom}-${i}.png`),
  cv: `<p><strong>Nascuda a Lleida.</strong></p><p>Llicenciada&nbsp;en Dret.</p>`,
});

/** govern.cat fa servir el nom amb què es coneix cada persona, que pot no ser l'oficial. */
const PERFILS_GOVERN = [
  perfil('Anna Exemple i U', 'Presidenta de la Generalitat de Catalunya'),
  perfil('Bet Exemple Dos', 'Consellera de la Presidència'),
  perfil('Carla Exemple i Tres', 'Consellera de Salut\n'),
];

const desats = (fitxes = PERFILS_GOVERN): PerfilsDesats => ({
  consultat: '2026-11-21',
  total: fitxes.length,
  fitxes,
});

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
  const resultat = await construirGovern(govern(GOVERN), desats());
  assert.equal(resultat.data_dades, '2026-09-29');
  assert.equal(resultat.data_noms, '2026-11-20');
  assert.deepEqual(resultat.president, {
    nom: 'Anna Èxemple i U',
    carrec: 'Presidenta de la Generalitat',
    departament: PRESIDENCIA,
    nom_oficial: 'EXEMPLE U, ANNA',
    carrec_oficial: 'PRESIDENT DE LA GENERALITAT DE CATALUNYA',
    retribucio_anual: 1,
    foto: 'https://govern.cat/govern/docs/Anna Exemple i U-0.png',
    cv: ['Nascuda a Lleida.', 'Llicenciada en Dret.'],
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
  await assert.rejects(construirGovern(govern(GOVERN, noms), desats()), /coincideix amb 0 noms/);
});

test('el Govern falla si un nom coincideix amb dues persones', async () => {
  const noms = [...NOMS, { nom: 'Berta Maria Exemple Dos' }];
  await assert.rejects(construirGovern(govern(GOVERN, noms), desats()), /coincideix amb 2 noms/);
});

test('el Govern falla si un departament no té conseller', async () => {
  const files = GOVERN.filter((f) => f.cognoms_nom !== 'EXEMPLE TRES, CARLA');
  await assert.rejects(construirGovern(govern(files), desats()), /Salut té 0 consellers/);
});

test('el Govern falla si no hi ha president', async () => {
  const files = GOVERN.filter((f) => f.cognoms_nom !== 'EXEMPLE U, ANNA');
  await assert.rejects(construirGovern(govern(files), desats()), /0 presidents/);
});

test('els imports de la relació passen a euros', () => {
  assert.equal(euros('146.635,82 €'), 146635.82);
  assert.equal(euros('980,00 €'), 980);
  assert.throws(() => euros('146635.82'), /forma inesperada/);
});

const NA = Object.fromEntries(
  [
    'activitat_sector_public',
    'exercici_carrecs',
    'representacio_organs_colegiats',
    'representacio_consells',
    'missions_temporals',
    'participacio_organs',
    'pertinenca_consells_administracio',
    'carrecs_electius_compatibles',
    'administracio_patrimoni',
    'administracio_patrimoni_personal',
    'participacio_ocasional',
    'participacio_seminaris',
    'produccio_creacio_literaries',
    'participacio_entitats_sense',
  ].map((camp) => [camp, 'N/A']),
);

const declaracio = (nom: string, carrec: string, situacio = 'Actiu', extra = {}) => {
  const [propi, primer, segon] = nom.split(' ');
  return {
    nom: propi,
    primer_cognom: primer,
    segon_cognom: segon,
    carrec,
    situaci_carrec: situacio,
    data_nomenament: '12/8/2024',
    ...NA,
    ...extra,
  };
};

const VIATGES_FILES: object[] = [
  {
    nom_i_cognoms: 'Berta Exemple i Dos',
    c_rrec: 'Consellera de Salut',
    inici_viatge: '2025-05-02T00:00:00.000',
    fi_viatge: '2025-05-04T00:00:00.000',
    destinaci: 'Ciutat U',
    motiu: 'Motiu U',
  },
  {
    nom_i_cognoms: 'Berta Exemple Dos',
    c_rrec: 'consellera de Salut',
    inici_viatge: '2025-02-02T00:00:00.000',
    fi_viatge: '2025-02-03T00:00:00.000',
    destinaci: 'Ciutat Dos',
    motiu: 'Motiu Dos',
    total_despeses: '100.5',
  },
];

const MEMBRES = [{ nom: 'Berta Exemple i Dos', nom_oficial: 'EXEMPLE DOS, BERTA' }];

const COLUMNES = [
  { fieldName: 'nom', name: 'Nom', description: 'Nom de l’alt càrrec' },
  ...Object.keys(NA).map((camp, i) => ({
    fieldName: camp,
    name: i < 8 ? `Activitat pública ${i + 1} (${camp})` : `Activitat privada ${i - 7} (${camp})`,
    description: `Descripció oficial de ${camp}`,
  })),
];

function transparencia(declaracions: object[], viatges = VIATGES_FILES) {
  return fake((url) => {
    if (url.includes('/api/views/'))
      return {
        name: 'Relació',
        rowsUpdatedAt: 1795208408,
        attribution: 'Direcció',
        columns: COLUMNES,
      };
    if (url.includes(DECLARACIONS)) return declaracions;
    if (url.includes(AGENDA))
      return [
        {
          data: '2025-03-01T00:00:00.000',
          grup_d_inter_s: 'Entitat U',
          activitat: 'Reunió',
          tema: 'Tema U',
          nom_i_cognoms: 'Berta Exemple Dos',
          c_rrec: 'consellera de Salut',
        },
        // La mateixa reunió amb un altre grup: és una sola reunió.
        {
          data: '2025-03-01T00:00:00.000',
          grup_d_inter_s: 'Entitat Quatre',
          activitat: 'Reunió',
          tema: 'Tema U',
          nom_i_cognoms: 'Berta Exemple Dos',
          c_rrec: 'consellera de Salut',
        },
        // Abans del nomenament, amb un altre càrrec o sense grup d'interès: no compten.
        {
          data: '2025-06-01T00:00:00.000',
          grup_d_inter_s: '-',
          activitat: "Sense activitats d'influència en el darrer trimestre",
          nom_i_cognoms: 'Berta Exemple Dos',
          c_rrec: 'consellera de Salut',
        },
        {
          data: '2024-08-01T00:00:00.000',
          grup_d_inter_s: 'Entitat Dos',
          activitat: 'Reunió',
          tema: 'Tema Dos',
          nom_i_cognoms: 'Berta Exemple Dos',
          c_rrec: 'consellera de Salut',
        },
        {
          data: '2025-01-01T00:00:00.000',
          grup_d_inter_s: 'Entitat Tres',
          activitat: 'Reunió',
          tema: 'Tema Tres',
          nom_i_cognoms: 'Berta Exemple Dos',
          c_rrec: 'Secretària general',
        },
      ];
    if (url.includes(VIATGES)) return viatges;
    throw new Error(`URL inesperada: ${url}`);
  });
}

test('la transparència dona la declaració, l’agenda i els viatges des del nomenament', async () => {
  const declaracions = [
    declaracio('Berta Exemple Dos', 'Consellera', 'Actiu', {
      participacio_entitats_sense: '1. Entitat U\n2. Entitat Dos',
    }),
    // El càrrec anterior, ja inactiu, no és la declaració d'ara.
    declaracio('Berta Exemple Dos', 'Secretària general', 'Inactiu'),
  ];
  const resultat = await construirTransparencia(transparencia(declaracions), MEMBRES);
  assert.equal(resultat.agenda.data_dades, '2026-11-20');
  const [persona] = resultat.persones;
  assert.equal(persona!.nomenament, '2024-08-12');
  assert.deepEqual(persona!.activitats, [
    {
      camp: 'participacio_entitats_sense',
      tipus: 'privada',
      apartat: 'Descripció oficial de participacio_entitats_sense',
      items: ['Entitat U', 'Entitat Dos'],
    },
  ]);
  assert.equal(persona!.agenda.reunions, 1);
  assert.deepEqual(persona!.agenda.darreres[0]!.grups, ['Entitat U', 'Entitat Quatre']);
  assert.equal(persona!.viatges.viatges, 2);
  assert.equal(persona!.viatges.sense_despeses, 1);
  assert.equal(persona!.viatges.despeses, 100.5);
});

test('sense cap import publicat no hi ha suma de despeses', async () => {
  const declaracions = [declaracio('Berta Exemple Dos', 'Consellera')];
  const sensImport = VIATGES_FILES.map((v) => ({ ...v, total_despeses: undefined }));
  const resultat = await construirTransparencia(
    transparencia(declaracions, JSON.parse(JSON.stringify(sensImport))),
    MEMBRES,
  );
  assert.equal('despeses' in resultat.persones[0]!.viatges, false);
});

test('la transparència falla si un import no té la forma esperada', async () => {
  const declaracions = [declaracio('Berta Exemple Dos', 'Consellera')];
  const viatges = VIATGES_FILES.map((v) => ({ ...v, total_despeses: '1.234,56' }));
  await assert.rejects(
    construirTransparencia(transparencia(declaracions, viatges), MEMBRES),
    /Import amb una forma inesperada/,
  );
});

test('la transparència falla si un membre no té cap declaració activa', async () => {
  const declaracions = [declaracio('Berta Exemple Dos', 'Consellera', 'Inactiu')];
  await assert.rejects(
    construirTransparencia(transparencia(declaracions), MEMBRES),
    /0 declaracions/,
  );
});

test('el Govern troba la fitxa de govern.cat encara que el nom no sigui l’oficial', async () => {
  const resultat = await construirGovern(govern(GOVERN), desats());
  assert.equal(
    resultat.consellers[0]!.foto,
    'https://govern.cat/govern/docs/Bet Exemple Dos-0.png',
  );
  assert.equal(resultat.data_perfils, '2026-11-21');
});

test('el Govern falla si un membre no té fitxa a govern.cat', async () => {
  const perfils = PERFILS_GOVERN.filter((p) => p.nom !== 'Bet Exemple Dos');
  await assert.rejects(construirGovern(govern(GOVERN), desats(perfils)), /0 fitxes a govern.cat/);
});

test('el Govern falla si una fitxa de govern.cat no té foto principal', async () => {
  const perfils = [
    ...PERFILS_GOVERN.slice(0, 2),
    perfil('Carla Exemple i Tres', 'Consellera de Salut', 0),
  ];
  await assert.rejects(construirGovern(govern(GOVERN), desats(perfils)), /0 fotos principals/);
});

test('les fitxes copiades de govern.cat han de ser totes', () => {
  const text = JSON.stringify({ ...desats(), total: 4 });
  assert.throws(() => llegirPerfils(text), /té 3 fitxes de les 4/);
});

test('el mapa falla si un color no és un color de CSS', () => {
  const html = mapa().replaceAll('#aaa', '#aaa;x');
  assert.throws(() => llegirMapa(html), /color inesperat/);
});
