// Les dades que canvien poc: el Govern i la composició del Parlament. No és un servidor MCP:
// src/dades.ts les desa en JSON a dades/ perquè la web les pugui mostrar sense consultar les fonts.
// Abans de tornar res, cada funció comprova que el que ha llegit quadra. Si la font canvia de forma,
// val més aturar-se que publicar una composició incompleta.
import { getJson, getText, SourceError, words, type Fetch } from './comun.ts';

const PARLAMENT = 'https://www.parlament.cat';
export const MAPA_ESCONS = `${PARLAMENT}/web/composicio/distribucio-escons/index.html`;
export const fitxaUrl = (codi: string) =>
  `${PARLAMENT}/web/composicio/diputats-fitxa/index.html?p_codi=${codi}`;
export const ESCONS = 135;

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
    if (grups.size !== 1 || subgrups.size > 1)
      throw new SourceError(`El mapa d'escons no dona un sol grup per al codi ${codi}.`);
    const [grup] = grups as unknown as [string];
    const [subgrup] = subgrups;
    return { codi, esco: Number(esco), carrec, grup, ...(subgrup && { subgrup }), sigla };
  });
  if (new Set(escons.map((e) => e.esco)).size !== ESCONS)
    throw new SourceError(`El mapa d'escons no té ${ESCONS} escons diferents.`);
  return escons.sort((a, b) => a.esco - b.esco);
}

/** El que diu la fitxa d'una persona diputada. */
export type Fitxa = {
  nom: string;
  circumscripcio: string;
  llista_electoral: string;
  partit?: string;
  grup?: string;
  legislatura?: { numero: string; inici: number };
};

export function llegirFitxa(html: string, url: string): Fitxa {
  comprovaCodificacio(html, url);
  const nom = html.match(/alt="Fotografia de ([^"]+)"/)?.[1];
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

  // La legislatura en curs només surt a les fitxes de qui ja havia estat diputat en una altra.
  const legislatures = new Set(
    diputats.flatMap(({ fitxa: f }) => (f.legislatura ? [JSON.stringify(f.legislatura)] : [])),
  );
  if (legislatures.size !== 1)
    throw new SourceError(`Les fitxes donen ${legislatures.size} legislatures en curs, no una.`);
  const legislatura = JSON.parse([...legislatures][0]!) as { numero: string; inici: number };

  const grups = new Map<
    string,
    { nom: string; sigla: string; escons: number; subgrups: Map<string, number> }
  >();
  for (const { esco } of diputats) {
    const grup = grups.get(esco.grup) ?? {
      nom: esco.grup,
      sigla: esco.sigla,
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
    })),
  };
}

type AltCarrec = {
  cognoms_nom: string;
  sexe: string;
  denominacio_lloc: string;
  departament: string;
};

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
  const [cognoms, nom] = oficial.split(',');
  const buscades = words(`${nom} ${cognoms}`);
  const trobats = noms.filter((n) => buscades.every((w) => words(n).includes(w)));
  if (trobats.length !== 1)
    throw new SourceError(
      `«${oficial}» coincideix amb ${trobats.length} noms de les intervencions del Govern, no amb un.`,
    );
  return trobats[0]!;
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
export async function construirGovern(fetchImpl: Fetch) {
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
  });
  return {
    font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
    url: `${SOCRATA}/d/${ALTS_CARRECS}`,
    data_dades: dia(meta),
    font_noms: `Dades obertes de Catalunya: ${metaNoms.name} (${metaNoms.attribution})`,
    url_noms: `${SOCRATA}/d/${INTERVENCIONS}`,
    data_noms: dia(metaNoms),
    nota: 'Qui forma el Govern i el departament que porta surten de la relació d’alts càrrecs. El nom ben escrit surt de les intervencions del Govern al Parlament, perquè la relació l’escriu en majúscules i a vegades sense accents; el nom i el càrrec tal com els escriu la relació són a nom_oficial i carrec_oficial.',
    president: persona(presidents[0]!, true),
    consellers: consellers
      .map((f) => persona(f))
      .sort((a, b) => a.departament.localeCompare(b.departament, 'ca')),
  };
}

/** Tot el que es publica, pel nom del fitxer. El Govern primer: l'ordre de les crides es reprodueix. */
export async function construirInstitucions(fetchImpl: Fetch, avui: string, pausaMs: number) {
  return {
    'govern.json': await construirGovern(fetchImpl),
    'parlament.json': await construirParlament(fetchImpl, avui, pausaMs),
  };
}
