// Servidor MCP de Dades obertes de Catalunya, el portal de la Generalitat
// (https://analisi.transparenciacatalunya.cat): una plataforma Socrata sense clau. Cada conjunt té
// columnes i es consulta amb SoQL, un SQL reduït que l'API executa.
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { getJson, READ_ONLY_EXTERNAL, run, SourceError, type Fetch } from './comun.ts';

const API = 'https://analisi.transparenciacatalunya.cat';
const SOURCE =
  "Font: Dades obertes de Catalunya, Generalitat de Catalunya (analisi.transparenciacatalunya.cat). Cita el conjunt i l'organisme que el publica.";
export const MAX_FILES = 1000;

const INSTRUCTIONS = `Els conjunts de dades obertes de la Generalitat de Catalunya: accidents, salut, educació, medi ambient, ocupació, contractació pública, pressupostos, transport i molts més, publicats per cada departament.
- Busca el conjunt amb cercar_conjunt, mira'n les columnes amb veure_conjunt i consulta'l amb consultar_dades.
- consultar_dades fa servir SoQL amb els noms de camp (fieldName) de veure_conjunt: $select «nomcom, count(*) as n», $where «any = 2023 and nomcom = 'Osona'», $group, $order. Agrega a l'API en lloc de demanar files soltes.
- Els textos es comparen exactament, amb majúscules i accents: copia els valors de veure_conjunt o fes servir upper(camp) like '%TEXT%'. Un resultat buit o un count(*) de 0 amb un filtre de text pot voler dir que el valor no s'ha escrit igual, no que no hi hagi dades.
- veure_conjunt només mostra els valors més freqüents. Per veure'ls tots, consulta $select «camp, count(*)» amb $group «camp».
- Per paginar amb offset, fixa sempre un $order: sense, les pàgines poden repetir o saltar files.
- Els números i les dates arriben com a text.
- La data que compta és «dades_actualitzades», no la freqüència anunciada: un conjunt que diu actualitzar-se cada any pot tenir les dades d'anys enrere. Digues-la sempre amb el resultat.
${SOURCE}`;

const id = z
  .string()
  .regex(/^[a-z0-9]{4}-[a-z0-9]{4}$/)
  .describe('Identificador del conjunt, de cercar_conjunt, com rmgc-ncpb.');

const date = (iso: string | undefined) => iso?.slice(0, 10);

type CatalogResult = {
  resource: {
    id: string;
    name: string;
    description: string;
    attribution: string | null;
    data_updated_at: string;
  };
  classification: {
    domain_category?: string;
    domain_metadata?: { key: string; value: string }[];
  };
  permalink: string;
};

export async function cercarConjunt(fetchImpl: Fetch, q: string) {
  // Sense `domains`, el catàleg barreja conjunts federats d'altres portals (L'Hospitalet…) que aquí
  // responen 404.
  const params = new URLSearchParams({
    q,
    only: 'dataset',
    domains: new URL(API).hostname,
    limit: '20',
  });
  const data = await getJson<{ resultSetSize: number; results: CatalogResult[] }>(
    fetchImpl,
    `${API}/api/catalog/v1?${params}`,
  );
  return {
    total: data.resultSetSize,
    conjunts: data.results.map(({ resource: r, classification: c, permalink }) => ({
      id: r.id,
      nom: r.name,
      descripcio: r.description.slice(0, 300),
      organisme: r.attribution ?? undefined,
      categoria: c.domain_category,
      frequencia: c.domain_metadata?.find((m) => m.key.startsWith('Freqüència'))?.value,
      dades_actualitzades: date(r.data_updated_at),
      enllac: permalink,
    })),
  };
}

type Column = {
  fieldName: string;
  name: string;
  dataTypeName: string;
  description?: string;
  cachedContents?: {
    cardinality?: string;
    smallest?: string;
    largest?: string;
    top?: { item: unknown }[];
  };
};
type View = {
  name: string;
  description?: string;
  attribution?: string;
  category?: string;
  rowsUpdatedAt?: number;
  columns: Column[];
};

/**
 * Una crida a un conjunt. Un 404 vol dir que el conjunt no existeix, i un 400 explica què falla de
 * la consulta («No such column: nope»): tots dos es diuen a l'assistent perquè ho corregeixi.
 */
async function socrata<T>(fetchImpl: Fetch, conjunt: string, path: string) {
  let response: Response;
  try {
    response = await fetchImpl(`${API}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SourceError('La font no respon. Torna-ho a provar més tard.');
  }
  if (response.status === 404)
    throw new SourceError(`No hi ha cap conjunt «${conjunt}». Busca'l amb cercar_conjunt.`);
  if (response.status === 400) {
    const { message } = (await response.json()) as { message: string };
    // Es talla abans de «; position», que repeteix tota la consulta interna.
    throw new SourceError(`La consulta SoQL no és vàlida: ${message.split('; position')[0]}`);
  }
  if (!response.ok) throw new SourceError(`La font ha respost ${response.status}.`);
  return (await response.json()) as T;
}

export async function veureConjunt(fetchImpl: Fetch, conjunt: string) {
  const v = await socrata<View>(fetchImpl, conjunt, `/api/views/${conjunt}.json`);
  return {
    nom: v.name,
    descripcio: v.description,
    organisme: v.attribution,
    categoria: v.category,
    dades_actualitzades:
      v.rowsUpdatedAt && new Date(v.rowsUpdatedAt * 1000).toISOString().slice(0, 10),
    columnes: v.columns.map((c) => {
      const cache = c.cachedContents;
      return {
        camp: c.fieldName,
        nom: c.name,
        tipus: c.dataTypeName,
        descripcio: c.description || undefined,
        valors_diferents: cache?.cardinality && Number(cache.cardinality),
        minim: cache?.smallest,
        maxim: cache?.largest,
        // Els valors més freqüents d'un text, per escriure els filtres tal com són («Barcelonès», no «barcelones»).
        valors_frequents:
          c.dataTypeName === 'text' ? cache?.top?.slice(0, 15).map((t) => t.item) : undefined,
      };
    }),
  };
}

export type Soql = {
  select?: string;
  where?: string;
  group?: string;
  order?: string;
  limit: number;
  offset?: number;
};

export async function consultarDades(fetchImpl: Fetch, conjunt: string, soql: Soql) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(soql))
    if (value !== undefined) params.set(`$${key}`, String(value));
  const files = await socrata<Record<string, unknown>[]>(
    fetchImpl,
    conjunt,
    `/resource/${conjunt}.json?${params}`,
  );
  // Un text mal escrit al $where no dona cap error: torna zero files, o un count(*) de «0», que
  // semblen una dada real.
  const zero =
    !files.length || (files.length === 1 && Object.values(files[0]!).every((v) => v === '0'));
  return {
    files,
    total: files.length,
    avis:
      zero && soql.where?.includes("'")
        ? `Cap resultat. Abans de dir que no n'hi ha, comprova que els textos del $where s'escriuen exactament com al conjunt (majúscules i accents): consulta els valors amb $select camp, count(*) i $group camp.`
        : files.length === soql.limit
          ? `S'han retornat les ${soql.limit} files del límit i pot haver-n'hi més: no és el total. Per comptar, agrega amb count(*).`
          : undefined,
  };
}

export function createDadesObertesServer(fetchImpl: Fetch = fetch) {
  const s = new McpServer(
    {
      name: 'finestra-oberta-dades-obertes',
      title: 'Dades obertes de Catalunya',
      version: '0.1.0',
    },
    { instructions: INSTRUCTIONS },
  );
  s.registerTool(
    'cercar_conjunt',
    {
      title: 'Cercar un conjunt',
      description:
        'Els conjunts de dades obertes de la Generalitat que coincideixen amb `q`, dels més rellevants als que menys, amb el seu organisme i la data de les seves dades.',
      inputSchema: z.object({ q: z.string().min(2).max(100) }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ q }) => run(SOURCE, () => cercarConjunt(fetchImpl, q)),
  );
  s.registerTool(
    'veure_conjunt',
    {
      title: 'Veure un conjunt',
      description:
        "Les columnes d'un conjunt amb el seu nom de camp per a SoQL, tipus, descripció, mínim i màxim i els valors més freqüents, i la data de les dades.",
      inputSchema: z.object({ conjunt: id }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ conjunt }) => run(SOURCE, () => veureConjunt(fetchImpl, conjunt)),
  );
  s.registerTool(
    'consultar_dades',
    {
      title: 'Consultar dades',
      description: `Executa una consulta SoQL sobre un conjunt. Totes les clàusules són opcionals; fes servir els noms de camp de veure_conjunt. Com a màxim ${MAX_FILES} files.`,
      inputSchema: z.object({
        conjunt: id,
        select: z.string().max(500).optional().describe('Com «nomcom, sum(f_morts) as morts».'),
        where: z.string().max(500).optional().describe("Com «any = 2023 and nomdem = 'Girona'»."),
        group: z.string().max(200).optional().describe('Com «nomcom».'),
        order: z.string().max(200).optional().describe('Com «morts desc».'),
        limit: z.number().int().min(1).max(MAX_FILES).default(100),
        offset: z.number().int().min(0).optional(),
      }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ conjunt, ...soql }) => run(SOURCE, () => consultarDades(fetchImpl, conjunt, soql)),
  );
  return s;
}
