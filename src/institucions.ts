// Les dades que canvien poc: el Govern i la composició del Parlament. No és un servidor MCP:
// src/dades.ts les desa en JSON a dades/ perquè la web les pugui mostrar sense consultar les fonts.
// Abans de tornar res, cada funció comprova que el que ha llegit quadra. Si la font canvia de forma,
// val més aturar-se que publicar una composició incompleta.
import { z } from 'zod';
import { fold, getJson, getText, SourceError, words, type Fetch } from './comun.ts';

const PARLAMENT = 'https://www.parlament.cat';
export const MAPA_ESCONS = `${PARLAMENT}/web/composicio/distribucio-escons/index.html`;
export const fitxaUrl = (codi: string) =>
  `${PARLAMENT}/web/composicio/diputats-fitxa/index.html?p_codi=${codi}`;
export const ESCONS = 135;
// La fitxa mostra la foto petita (B, 175 px d'ample). El mateix servei la dona fins a 600 px pel
// costat llarg (M, uns 50 kB) i l'original (A), d'uns 1.600 x 2.400 px, passa d'1 MB.
export const fotoUrl = (id: string) => `${PARLAMENT}/apl/gimg/imatgeweb?p_mida=M&p_id=${id}`;
export const AVIS_LEGAL = `${PARLAMENT}/pcat/serveis-parlament/avis-legal`;

const SOCRATA = 'https://analisi.transparenciacatalunya.cat';
export const ALTS_CARRECS = 'x9au-abcn';
export const INTERVENCIONS = '7chp-hkce';
const PRESIDENT = 'PRESIDENT DE LA GENERALITAT DE CATALUNYA';

/** Un escó tal com el dibuixa el mapa del Parlament. */
export type Esco = {
  codi: string;
  esco: number;
  carrec: string;
  grup: string;
  subgrup?: string;
  sigla: string;
  /** El color del grup al mapa del Parlament: «#C70A08» o un nom de CSS com «grey». */
  color: string;
};

const ENTITATS: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  '#39': "'",
  '#039': "'",
  '#038': '&',
};

/** El text d'un tros d'HTML. Una entitat desconeguda és un error: no es pot endevinar. */
function text(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&([#\w]+);/g, (whole, name: string) => {
      const value = ENTITATS[name];
      if (value === undefined) throw new SourceError(`Entitat HTML desconeguda: ${whole}.`);
      return value;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function comprovaCodificacio(html: string, url: string) {
  if (html.includes('�')) throw new SourceError(`${url} té caràcters mal codificats.`);
}

/** Els escons del mapa: una crida `afegirEsco(...)` per escó, amb el color de la llegenda. */
export function llegirMapa(html: string): Esco[] {
  comprovaCodificacio(html, MAPA_ESCONS);
  const llegenda = new Map(
    [...html.matchAll(/afegirLlegenda\("([^"]*)", "([^"]*)"\)/g)].map((m) => [m[1]!, m[2]!]),
  );
  // Cada escó surt més d'un cop, perquè el mapa es dibuixa per a diverses mides. Les còpies han de
  // coincidir, llevat que una doni el grup i una altra el subgrup: els membres d'un subgrup surten
  // de totes dues maneres.
  const crides = new Map<string, { camps: string; grups: Set<string>; subgrups: Set<string> }>();
  for (const m of html.matchAll(
    /afegirEsco\(midaEsco, "([^"]*)", "(\d+)", "([^"]*)", "([^"]*)", "[^"]*", "[^"]*", "([^"]*)", "[^"]*\?p_codi=(\d+)"\)/g,
  )) {
    const [, color, esco, nom, carrec, grup, codi] = m as unknown as string[];
    const camps = [color, esco, nom, carrec].join('|');
    const crida = crides.get(codi!) ?? { camps, grups: new Set(), subgrups: new Set() };
    if (crida.camps !== camps)
      throw new SourceError(`El mapa d'escons dona dades diferents per al codi ${codi}.`);
    (grup!.startsWith('Subgrup') ? crida.subgrups : crida.grups).add(grup!);
    crides.set(codi!, crida);
  }
  if (crides.size !== ESCONS)
    throw new SourceError(`El mapa d'escons té ${crides.size} persones, no ${ESCONS}.`);

  const escons = [...crides].map(([codi, { camps, grups, subgrups }]) => {
    const [color, esco, , carrec] = camps.split('|') as [string, string, string, string];
    const sigla = llegenda.get(color);
    if (sigla === undefined)
      throw new SourceError(`El color ${color} del mapa d'escons no és a la llegenda.`);
    // El color passa tal qual a la web: ha de ser un color de CSS i res més.
    if (!/^(#[0-9a-f]{3}|#[0-9a-f]{6}|[a-z]+)$/i.test(color))
      throw new SourceError(`El mapa d'escons té un color inesperat: ${color}.`);
    if (grups.size !== 1 || subgrups.size > 1)
      throw new SourceError(`El mapa d'escons no dona un sol grup per al codi ${codi}.`);
    const [grup] = grups as unknown as [string];
    const [subgrup] = subgrups;
    return { codi, esco: Number(esco), carrec, grup, ...(subgrup && { subgrup }), sigla, color };
  });
  if (new Set(escons.map((e) => e.esco)).size !== ESCONS)
    throw new SourceError(`El mapa d'escons no té ${ESCONS} escons diferents.`);
  return escons.sort((a, b) => a.esco - b.esco);
}

/** El que diu la fitxa d'una persona diputada. */
export type Fitxa = {
  nom: string;
  foto?: string;
  circumscripcio: string;
  llista_electoral: string;
  partit?: string;
  grup?: string;
  legislatura?: { numero: string; inici: number };
};

export function llegirFitxa(html: string, url: string): Fitxa {
  comprovaCodificacio(html, url);
  const nom = html.match(/alt="Fotografia de ([^"]+)"/)?.[1];
  // Una persona que acaba d'entrar pot no tenir foto encara: llavors no en té, i la composició
  // s'actualitza igualment. construirParlament comprova que la forma de l'URL no ha canviat.
  const foto = html.match(/\/apl\/gimg\/imatgeweb\?p_mida=\w+&(?:amp;)?p_id=(\d+)/)?.[1];
  const camps = new Map(
    [...html.matchAll(/<dt>([^<]*?):\s*<\/dt><dd>(.*?)<\/dd>/g)].map((m) => [m[1]!, m[2]!]),
  );
  const circumscripcio = camps.get('Circumscripció');
  const llista = camps.get('Llista Electoral');
  if (nom === undefined || circumscripcio === undefined || llista === undefined)
    throw new SourceError(`A la fitxa ${url} hi falta el nom, la circumscripció o la llista.`);
  const lloc = text(circumscripcio).match(/^Circumscripció electoral de (.+)$/)?.[1];
  if (lloc === undefined)
    throw new SourceError(`La circumscripció de ${url} no té la forma esperada.`);
  const partit = camps.get('Partit Polític');
  // «Grup Parlamentari de Junts. Membre. Alta: 18.06.2024…»: només ens quedem amb el nom.
  const grup = camps.get('Grup parlamentari');
  const actual = camps
    .get('Membre de la legislatura')
    ?.match(/>\s*([IVXLC-]+) \((\d{4})-actualitat\)/);
  return {
    nom: text(nom),
    ...(foto && { foto: fotoUrl(foto) }),
    circumscripcio: lloc,
    llista_electoral: text(llista),
    ...(partit && { partit: text(partit) }),
    ...(grup && { grup: text(grup).split(' . ')[0]! }),
    ...(actual && { legislatura: { numero: actual[1]!, inici: Number(actual[2]) } }),
  };
}

const pausa = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** La composició del Parlament: el mapa d'escons i, de cada persona, la seva fitxa. */
export async function construirParlament(fetchImpl: Fetch, avui: string, pausaMs = 300) {
  const escons = llegirMapa(await getText(fetchImpl, MAPA_ESCONS));
  const diputats = [];
  for (const esco of escons) {
    const url = fitxaUrl(esco.codi);
    // D'una en una i amb pausa: són 135 pàgines del web del Parlament, no una API.
    if (diputats.length) await pausa(pausaMs);
    const fitxa = llegirFitxa(await getText(fetchImpl, url), url);
    if (fitxa.grup !== undefined && fitxa.grup !== esco.grup && fitxa.grup !== esco.subgrup)
      throw new SourceError(`La fitxa ${url} diu ${fitxa.grup}, i el mapa, ${esco.grup}.`);
    diputats.push({ esco, fitxa, url });
  }

  // Si cap fitxa no dona foto, el més probable és que el web n'hagi canviat la forma. Una foto
  // repetida seria una imatge genèrica, no la de la persona.
  const fotos = diputats.flatMap(({ fitxa: f }) => (f.foto ? [f.foto] : []));
  if (fotos.length === 0) throw new SourceError('Cap fitxa no dona la foto.');
  if (new Set(fotos).size !== fotos.length)
    throw new SourceError('Hi ha fitxes que donen la mateixa foto.');

  // La legislatura en curs només surt a les fitxes de qui ja havia estat diputat en una altra.
  const legislatures = new Set(
    diputats.flatMap(({ fitxa: f }) => (f.legislatura ? [JSON.stringify(f.legislatura)] : [])),
  );
  if (legislatures.size !== 1)
    throw new SourceError(`Les fitxes donen ${legislatures.size} legislatures en curs, no una.`);
  const legislatura = JSON.parse([...legislatures][0]!) as { numero: string; inici: number };

  const grups = new Map<
    string,
    { nom: string; sigla: string; color: string; escons: number; subgrups: Map<string, number> }
  >();
  for (const { esco } of diputats) {
    const grup = grups.get(esco.grup) ?? {
      nom: esco.grup,
      sigla: esco.sigla,
      color: esco.color,
      escons: 0,
      subgrups: new Map(),
    };
    grup.escons++;
    if (esco.subgrup) grup.subgrups.set(esco.subgrup, (grup.subgrups.get(esco.subgrup) ?? 0) + 1);
    grups.set(esco.grup, grup);
  }

  return {
    font: 'Parlament de Catalunya: distribució d’escons i fitxes de les persones diputades',
    url: MAPA_ESCONS,
    data_consulta: avui,
    nota: 'El Parlament no publica la data d’actualització de la composició: data_consulta és el dia en què es va llegir aquesta composició. Els grups són els d’avui, que poden no coincidir amb els resultats de les eleccions.',
    fotos: `Les fotos són del Parlament de Catalunya i s’enllacen al seu web, sense copiar-les. El seu avís legal (${AVIS_LEGAL}) en permet la reutilització si se’n cita la font, no se n’altera el sentit i no es presenten com una versió oficial ni avalada pel Parlament. Cal mostrar-les amb «Foto: Parlament de Catalunya».`,
    legislatura,
    escons: ESCONS,
    grups: [...grups.values()]
      .sort((a, b) => b.escons - a.escons || a.nom.localeCompare(b.nom, 'ca'))
      .map(({ subgrups, ...grup }) => ({
        ...grup,
        ...(subgrups.size && {
          subgrups: [...subgrups].map(([nom, escons]) => ({ nom, escons })),
        }),
      })),
    diputats: diputats.map(({ esco, fitxa, url }) => ({
      nom: fitxa.nom,
      carrec: esco.carrec,
      grup: esco.grup,
      ...(esco.subgrup && { subgrup: esco.subgrup }),
      circumscripcio: fitxa.circumscripcio,
      llista_electoral: fitxa.llista_electoral,
      ...(fitxa.partit && { partit: fitxa.partit }),
      esco: esco.esco,
      fitxa: url,
      ...(fitxa.foto && { foto: fitxa.foto }),
    })),
  };
}

type AltCarrec = {
  cognoms_nom: string;
  sexe: string;
  denominacio_lloc: string;
  departament: string;
  retribucio_anual_prevista: string;
};

/** «146.635,82 €» en euros. Una altra forma és un error: no es pot endevinar on van els decimals. */
export function euros(text: string) {
  const m = text.match(/^(\d{1,3}(?:\.\d{3})*),(\d{2}) €$/);
  if (m === null) throw new SourceError(`Import amb una forma inesperada: ${text}.`);
  return Number(`${m[1]!.replaceAll('.', '')}.${m[2]}`);
}

const lloc = (fila: AltCarrec) => fila.denominacio_lloc.replace(/\s+/g, ' ').trim();

type Meta = { name: string; rowsUpdatedAt: number; attribution: string };
const metadades = (fetchImpl: Fetch, id: string) =>
  getJson<Meta>(fetchImpl, `${SOCRATA}/api/views/${id}.json`);
const dia = (meta: Meta) => new Date(meta.rowsUpdatedAt * 1000).toISOString().slice(0, 10);

/**
 * El nom ben escrit, de les intervencions del Govern al Parlament. La relació d'alts càrrecs
 * l'escriu en majúscules i a vegades sense accents («PANE MENA, OLGA» per «Olga Pané i Mena»), i
 * això no es pot refer sense una altra font. Les paraules del nom oficial han de ser totes al nom
 * escrit, i només en un.
 */
function nomEscrit(oficial: string, noms: string[]) {
  const trobats = noms.filter((n) => esLaPersona(oficial, n));
  if (trobats.length !== 1)
    throw new SourceError(
      `«${oficial}» coincideix amb ${trobats.length} noms de les intervencions del Govern, no amb un.`,
    );
  return trobats[0]!;
}

/** Si un nom escrit d'una altra manera conté totes les paraules del nom oficial («PANE MENA, OLGA»). */
function esLaPersona(oficial: string, nom: string) {
  const [cognoms, propi] = oficial.split(',');
  const paraules = words(nom);
  return words(`${propi} ${cognoms}`).every((w) => paraules.includes(w));
}

const GENERE: Record<string, { conseller: string; president: string }> = {
  Home: { conseller: 'Conseller', president: 'President de la Generalitat' },
  Dona: { conseller: 'Consellera', president: 'Presidenta de la Generalitat' },
};

/** «Consellera de Salut», del departament i del sexe; la relació diu «CONSELLER/A DE SALUT». */
function carrec(f: AltCarrec, president: boolean) {
  const genere = GENERE[f.sexe];
  if (genere === undefined) throw new SourceError(`Sexe desconegut a la relació: ${f.sexe}.`);
  if (president) return genere.president;
  const ambit = f.departament.match(/^Departament (.+)$/)?.[1];
  if (ambit === undefined)
    throw new SourceError(`Departament amb un nom inesperat: ${f.departament}.`);
  return `${genere.conseller} ${ambit}`;
}

/** El Govern: el president i els consellers i conselleres, de la relació oficial d'alts càrrecs. */
export async function construirGovern(fetchImpl: Fetch, perfilsDesats: PerfilsDesats) {
  const meta = await metadades(fetchImpl, ALTS_CARRECS);
  const limit = 5000;
  const files = await getJson<AltCarrec[]>(
    fetchImpl,
    `${SOCRATA}/resource/${ALTS_CARRECS}.json?$limit=${limit}`,
  );
  if (files.length === limit)
    throw new SourceError('La relació d’alts càrrecs no cap en una pàgina.');

  const presidents = files.filter((f) => lloc(f) === PRESIDENT);
  const consellers = files.filter((f) => lloc(f).startsWith('CONSELLER/A'));
  if (presidents.length !== 1)
    throw new SourceError(`La relació d’alts càrrecs té ${presidents.length} presidents.`);
  // Cada departament té una persona al capdavant, i només una.
  const departaments = new Set(files.map((f) => f.departament));
  for (const departament of departaments) {
    const n = consellers.filter((f) => f.departament === departament).length;
    if (n !== 1) throw new SourceError(`${departament} té ${n} consellers a la relació.`);
  }

  const metaNoms = await metadades(fetchImpl, INTERVENCIONS);
  const noms = (
    await getJson<{ nom: string }[]>(
      fetchImpl,
      `${SOCRATA}/resource/${INTERVENCIONS}.json?${new URLSearchParams({ $select: 'nom', $group: 'nom', $limit: String(limit) })}`,
    )
  ).map((r) => r.nom);
  if (noms.length === limit)
    throw new SourceError('Els noms de les intervencions no caben en una pàgina.');

  const persona = (f: AltCarrec, president = false) => ({
    nom: nomEscrit(f.cognoms_nom, noms),
    carrec: carrec(f, president),
    departament: f.departament,
    nom_oficial: f.cognoms_nom,
    carrec_oficial: lloc(f),
    retribucio_anual: euros(f.retribucio_anual_prevista),
  });
  const president = persona(presidents[0]!, true);
  const ordenats = consellers
    .map((f) => persona(f))
    .sort((a, b) => a.departament.localeCompare(b.departament, 'ca'));
  const perfils = construirPerfils(perfilsDesats, [president, ...ordenats]);
  return {
    font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
    url: `${SOCRATA}/d/${ALTS_CARRECS}`,
    data_dades: dia(meta),
    font_noms: `Dades obertes de Catalunya: ${metaNoms.name} (${metaNoms.attribution})`,
    url_noms: `${SOCRATA}/d/${INTERVENCIONS}`,
    data_noms: dia(metaNoms),
    nota: 'Qui forma el Govern i el departament que porta surten de la relació d’alts càrrecs. El nom ben escrit surt de les intervencions del Govern al Parlament, perquè la relació l’escriu en majúscules i a vegades sense accents; el nom i el càrrec tal com els escriu la relació són a nom_oficial i carrec_oficial.',
    font_perfils: 'govern.cat: el Consell Executiu',
    url_perfils: CONSELL_EXECUTIU,
    data_perfils: perfilsDesats.consultat,
    llicencia_perfils: `CC0, segons l’avís legal de govern.cat (${AVIS_GOVERN})`,
    president: { ...president, ...perfils[0]! },
    consellers: ordenats.map((c, i) => ({ ...c, ...perfils[i + 1]! })),
  };
}

export const AVIS_GOVERN = 'https://govern.cat/gov/avis-legal';
export const CONSELL_EXECUTIU = 'https://govern.cat/gov/consell-executiu';

/**
 * Les fitxes del Consell Executiu tal com les copia, des d'un navegador, la línia de
 * docs/institucions.md. govern.cat no respon als scripts, i per això no es llegeixen aquí.
 */
const perfilsDesats = z.object({
  consultat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.number().int(),
  fitxes: z.array(
    z.object({ nom: z.string(), carrec: z.string(), fotos: z.array(z.string()), cv: z.string() }),
  ),
});
export type PerfilsDesats = z.infer<typeof perfilsDesats>;

export function llegirPerfils(json: string): PerfilsDesats {
  const desats = perfilsDesats.parse(JSON.parse(json));
  if (desats.fitxes.length !== desats.total)
    throw new SourceError(
      `dades/perfils-govern.json té ${desats.fitxes.length} fitxes de les ${desats.total} de govern.cat.`,
    );
  return desats;
}

/** Els paràgrafs del currículum, que govern.cat publica en HTML. */
function paragrafs(html: string) {
  return html
    .split(/<\/(?:p|h\d)>/)
    .map(text)
    .filter(Boolean);
}

/**
 * El currículum i la foto de cada membre, de la fitxa que en publica govern.cat. La fitxa pot fer
 * servir el nom amb què se'l coneix («Berni» per «Bernardo»), i per això es troba pel càrrec, que ha
 * de començar com el de la relació d'alts càrrecs, i pels cognoms, que hi han de ser tots.
 */
export function construirPerfils(
  desats: PerfilsDesats,
  membres: { nom: string; nom_oficial: string; carrec: string }[],
) {
  return membres.map((m) => {
    const cognoms = words(m.nom_oficial.split(',')[0]);
    const seus = desats.fitxes.filter((f) => {
      const nom = words(f.nom);
      return fold(f.carrec).startsWith(fold(m.carrec)) && cognoms.every((c) => nom.includes(c));
    });
    if (seus.length !== 1)
      throw new SourceError(`${m.nom} té ${seus.length} fitxes a govern.cat, no una.`);
    const fitxa = seus[0]!;
    // Només hi compten les fotos principals (338 x 245), no les apaïsades de la capçalera.
    if (fitxa.fotos.length !== 1)
      throw new SourceError(
        `La fitxa de ${m.nom} a govern.cat té ${fitxa.fotos.length} fotos principals.`,
      );
    const cv = paragrafs(fitxa.cv);
    if (!cv.length) throw new SourceError(`La fitxa de ${m.nom} a govern.cat no té currículum.`);
    return { foto: fitxa.fotos[0]!, cv };
  });
}

export const DECLARACIONS = 'vdss-2ppz';
export const AGENDA = 'hd8k-y28e';
export const VIATGES = '5kte-hque';

/** Qui hi ha a govern.json: amb el nom oficial es troba cada persona a les altres relacions. */
type Membre = { nom: string; nom_oficial: string };

type Declaracio = Record<string, string> & {
  nom: string;
  primer_cognom: string;
  segon_cognom: string;
  carrec: string;
  situaci_carrec: string;
  data_nomenament: string;
};

/** Els apartats de la declaració, amb el nom que es mostra. La relació en descriu el contingut legal. */
const APARTATS: [camp: string, tipus: 'pública' | 'privada', nom: string][] = [
  ['activitat_sector_public', 'pública', 'Un altre lloc al sector públic'],
  ['exercici_carrecs', 'pública', 'Càrrecs que li corresponen pel càrrec'],
  [
    'representacio_organs_colegiats',
    'pública',
    'Representació de la Generalitat en òrgans col·legiats',
  ],
  [
    'representacio_consells',
    'pública',
    'Representació de la Generalitat en consells d’administració',
  ],
  ['missions_temporals', 'pública', 'Missions temporals de representació'],
  [
    'participacio_organs',
    'pública',
    'Òrgans de govern d’empreses o entitats privades, en representació de l’Administració',
  ],
  ['pertinenca_consells_administracio', 'pública', 'Tres o més consells d’administració'],
  ['carrecs_electius_compatibles', 'pública', 'Càrrecs electes'],
  ['administracio_patrimoni', 'privada', 'Administració del patrimoni personal o familiar'],
  [
    'administracio_patrimoni_personal',
    'privada',
    'Patrimoni en empreses que contracten amb el sector públic',
  ],
  ['participacio_ocasional', 'privada', 'Seminaris, cursos, conferències i mitjans de comunicació'],
  ['participacio_seminaris', 'privada', 'Formació per al personal de l’Administració'],
  ['produccio_creacio_literaries', 'privada', 'Creació literària, artística, científica o tècnica'],
  ['participacio_entitats_sense', 'privada', 'Entitats sense ànim de lucre'],
];

/** «1. Primera\n2. Segona» en una llista; «N/A» vol dir que no en declara cap. */
function llista(text: string, camp: string) {
  if (text === 'N/A') return [];
  const items = text
    .split('\n')
    .map((l) => l.replace(/^\s*\d+\s*\.\s*/, '').trim())
    .filter(Boolean);
  if (!items.length) throw new SourceError(`L'apartat ${camp} d'una declaració és buit.`);
  return items;
}

/** «12/8/2024» en ISO. */
function diaIso(text: string) {
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m === null) throw new SourceError(`Data amb una forma inesperada: ${text}.`);
  return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}

// Les relacions d'agenda i de viatges inclouen tots els alts càrrecs, també els de mandats anteriors:
// només compten les files amb el càrrec de president o de conseller i des del nomenament.
const esCarrecDelGovern = (carrec: string) =>
  /^(conseller|consellera|president de la generalitat|presidenta de la generalitat)\b/.test(
    fold(carrec),
  ) && !/^consellera? delegad/.test(fold(carrec));

type FilaAgenda = {
  data: string;
  grup_d_inter_s: string;
  activitat: string;
  tema?: string;
  nom_i_cognoms: string;
  c_rrec: string;
};

type FilaViatge = {
  nom_i_cognoms: string;
  c_rrec: string;
  inici_viatge: string;
  fi_viatge: string;
  destinaci: string;
  motiu: string;
  total_despeses?: string;
};

const DARRERES = 5;
const LIMIT = 50000;

async function totes<T>(fetchImpl: Fetch, id: string, params: Record<string, string>) {
  const files = await getJson<T[]>(
    fetchImpl,
    `${SOCRATA}/resource/${id}.json?${new URLSearchParams({ ...params, $limit: String(LIMIT) })}`,
  );
  if (files.length === LIMIT) throw new SourceError(`La relació ${id} no cap en una pàgina.`);
  return files;
}

const font = (meta: Meta, id: string) => ({
  font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
  url: `${SOCRATA}/d/${id}`,
  data_dades: dia(meta),
});

/**
 * El que el Govern publica de cada membre a més del càrrec i la retribució: la declaració
 * d'activitats, l'agenda amb grups d'interès i els viatges a l'estranger des del nomenament.
 */
export async function construirTransparencia(fetchImpl: Fetch, membres: Membre[]) {
  const [metaDecl, metaAgenda, metaViatges] = await Promise.all([
    metadades(fetchImpl, DECLARACIONS),
    metadades(fetchImpl, AGENDA),
    metadades(fetchImpl, VIATGES),
  ]);

  const declaracions = await totes<Declaracio>(fetchImpl, DECLARACIONS, {});
  const nomenaments = membres.map((m) => {
    const propies = declaracions.filter(
      (d) =>
        d.situaci_carrec === 'Actiu' &&
        esCarrecDelGovern(d.carrec) &&
        esLaPersona(m.nom_oficial, `${d.nom} ${d.primer_cognom} ${d.segon_cognom}`),
    );
    if (propies.length !== 1)
      throw new SourceError(
        `${m.nom} té ${propies.length} declaracions d'activitats actives com a membre del Govern, no una.`,
      );
    return propies[0]!;
  });
  const desDe = nomenaments.map((d) => diaIso(d.data_nomenament)).sort()[0]!;

  const agenda = await totes<FilaAgenda>(fetchImpl, AGENDA, {
    $select: 'data,grup_d_inter_s,activitat,tema,nom_i_cognoms,c_rrec',
    $where: `data >= '${desDe}'`,
    $order: 'data DESC',
  });
  const viatges = await totes<FilaViatge>(fetchImpl, VIATGES, {
    $select: 'nom_i_cognoms,c_rrec,inici_viatge,fi_viatge,destinaci,motiu,total_despeses',
    $where: `inici_viatge >= '${desDe}'`,
    $order: 'inici_viatge DESC',
  });

  const persones = membres.map((m, i) => {
    const declaracio = nomenaments[i]!;
    const nomenament = diaIso(declaracio.data_nomenament);
    const seves = <T extends { nom_i_cognoms: string; c_rrec: string }>(
      files: T[],
      data: (f: T) => string,
    ) =>
      files.filter(
        (f) =>
          data(f).slice(0, 10) >= nomenament &&
          esCarrecDelGovern(f.c_rrec) &&
          esLaPersona(m.nom_oficial, f.nom_i_cognoms),
      );
    // La relació també hi posa una fila sense grup («-») per dir que en un trimestre no n'hi ha hagut.
    const reunions = seves(agenda, (f) => f.data).filter((f) => f.grup_d_inter_s !== '-');
    const viatgesSeus = seves(viatges, (f) => f.inici_viatge);
    const ambDespeses = viatgesSeus.filter((v) => v.total_despeses !== undefined);
    return {
      nom: m.nom,
      nom_oficial: m.nom_oficial,
      nomenament,
      activitats: APARTATS.flatMap(([camp, tipus, nom]) => {
        const valor = declaracio[camp];
        if (valor === undefined)
          throw new SourceError(`A la declaració de ${m.nom} hi falta l'apartat ${camp}.`);
        const items = llista(valor, camp);
        return items.length ? [{ tipus, apartat: nom, items }] : [];
      }),
      agenda: {
        reunions: reunions.length,
        darreres: reunions.slice(0, DARRERES).map((r) => ({
          data: r.data.slice(0, 10),
          grup: r.grup_d_inter_s,
          activitat: r.activitat,
          ...(r.tema !== undefined && { tema: r.tema }),
        })),
      },
      viatges: {
        viatges: viatgesSeus.length,
        // Les despeses es publiquen quan s'han validat: els viatges recents en poden no tenir.
        sense_despeses: viatgesSeus.length - ambDespeses.length,
        despeses:
          Math.round(ambDespeses.reduce((s, v) => s + Number(v.total_despeses), 0) * 100) / 100,
        darrers: viatgesSeus.slice(0, DARRERES).map((v) => ({
          inici: v.inici_viatge.slice(0, 10),
          fi: v.fi_viatge.slice(0, 10),
          destinacio: v.destinaci,
          motiu: v.motiu,
          ...(v.total_despeses !== undefined && { despeses: Number(v.total_despeses) }),
        })),
      },
    };
  });

  return {
    declaracions: font(metaDecl, DECLARACIONS),
    agenda: font(metaAgenda, AGENDA),
    viatges: font(metaViatges, VIATGES),
    nota: 'L’agenda i els viatges compten des del nomenament de cada persona en el càrrec actual. Les despeses dels viatges es publiquen quan s’han validat, i sense_despeses diu quants viatges encara no en tenen. Segons la relació, l’import d’un viatge pot incloure el de la comitiva.',
    persones,
  };
}
