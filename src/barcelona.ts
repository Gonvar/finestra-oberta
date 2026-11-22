// Adaptat del servidor proposat a Reforma Digital a samuelcorsan/reforma-digital#265 (llicència MIT).
// Servidor MCP d'Open Data BCN, el portal de dades obertes de l'Ajuntament de
// Barcelona: la seva API CKAN, sense clau. Cada conjunt té recursos (fitxers); els que són al
// datastore es poden consultar fila a fila.
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { fold, READ_ONLY_EXTERNAL, run, SourceError, words, type Fetch } from './comun.ts';

const API = 'https://opendata-ajuntament.barcelona.cat/data/api/3/action';
const SOURCE =
  'Font: Open Data BCN, Ajuntament de Barcelona (opendata-ajuntament.barcelona.cat). Cita el conjunt i la seva llicència quan facis servir les dades.';
const MAX_RECURSOS = 20;

const INSTRUCTIONS = `Les dades obertes de l'Ajuntament de Barcelona: població, habitatge, mobilitat, medi ambient, equipaments, accidents, pressupostos i més, per barri i districte.
- Busca el conjunt amb cercar_conjunt, mira'n els recursos consultables amb veure_conjunt i demana les files d'un recurs amb consultar_dades.
- Demana primer les files amb limit 0 per veure'n els camps. Els noms dels camps i molts valors són en català.
- Les dades són de la data del seu recurs (creat), no de la del conjunt: un conjunt que diu actualitzar-se cada hora pot tenir l'últim recurs consultable de fa mesos. Dona sempre la data del recurs amb la dada.
- El datastore no suma: per donar un total (d'un districte, per exemple), cal agafar totes les files que compleixen la consulta, comparant-les amb «total» i paginant amb des_de, i dir quantes n'has sumat.
- Un conjunt amb freqüència «serie_interrompuda» ja no s'actualitza: digues-ho quan en donis les dades.
${SOURCE}`;

type Translated = { es?: string; ca?: string };
type Resource = {
  id: string;
  name: string;
  format: string;
  created: string;
  datastore_active: boolean;
  token_required?: string;
};
type Package = {
  name: string;
  title: string;
  title_translated?: Translated;
  notes_translated?: Translated;
  metadata_modified: string;
  frequency?: string;
  license_title?: string;
  fuente?: string;
  token_required?: string;
  tags?: { name: string }[];
  organization?: { title: string };
  resources: Resource[];
};

/**
 * Una acció de CKAN. Els seus 409 diuen en JSON quin paràmetre no val («filters: invalid value
 * "nope"»): es passa a l'assistent perquè corregeixi la crida.
 */
async function request<T>(fetchImpl: Fetch, action: string, params: Record<string, string>) {
  let response: Response;
  try {
    // Un paràmetre repetit fa que el portal respongui 500: cadascun hi va una sola vegada.
    response = await fetchImpl(`${API}/${action}?${new URLSearchParams(params)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SourceError('La font no respon. Torna-ho a provar més tard.');
  }
  if (response.ok) return ((await response.json()) as { result: T }).result;
  if (response.status === 404)
    throw new SourceError(
      'No existeix aquest conjunt o recurs, o no es pot consultar fila a fila.',
    );
  if (response.status === 409) {
    const body = (await response.text()) || '{}';
    let error: Record<string, unknown> | undefined;
    try {
      ({ error } = JSON.parse(body) as { error?: Record<string, unknown> });
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
    if (!error) throw new SourceError('La font ha respost 409.');
    const why = Object.entries(error)
      .filter(([field]) => field !== '__type')
      .map(([field, value]) => `${field}: ${[value].flat().join(', ')}`)
      .join('; ');
    throw new SourceError(`Paràmetre no vàlid: ${why}.`);
  }
  throw new SourceError(`La font ha respost ${response.status}.`);
}

// El portal respon 503 a les peticions que li arriben alhora (el 22/11/2026, tres de cinc), i els
// assistents fan crides en paral·lel: les peticions van d'una en una.
let queue: Promise<unknown> = Promise.resolve();
function ckan<T>(fetchImpl: Fetch, action: string, params: Record<string, string>) {
  const result = queue.then(() => request<T>(fetchImpl, action, params));
  queue = result.catch(() => undefined);
  return result;
}

const title = (p: Package) => p.title_translated?.ca || p.title_translated?.es || p.title;
const notes = (p: Package) => p.notes_translated?.ca || p.notes_translated?.es || '';
const short = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text.trim();
const queryable = (p: Package) =>
  p.token_required === 'Yes'
    ? []
    : p.resources.filter((r) => r.datastore_active && r.token_required !== 'Yes');

// Només el que dona la cerca: el catàleg sencer ocupa uns 13 MB.
const summary = (p: Package) => ({
  id: p.name,
  titol: title(p),
  descripcio: short(notes(p), 300),
  frequencia: p.frequency?.toLowerCase(),
  recursos_consultables: queryable(p).length,
  ...(p.token_required === 'Yes' && { nota: 'Només es baixa amb un token del portal.' }),
});
type Entry = {
  conjunt: ReturnType<typeof summary>;
  modified: string;
  titles: string;
  rest: string;
};
// El catàleg sencer (uns 560 conjunts) es demana un cop al dia: la cerca del portal no troba els
// títols en castellà («población» dona 0) i exigeix totes les paraules. Un catàleg per `fetch`, perquè
// cada servidor (i cada prova) tingui el seu.
const catalogs = new WeakMap<Fetch, { at: number; entries: Promise<Entry[]> }>();
const DAY = 24 * 60 * 60 * 1000;

const searchable = (...texts: (string | undefined)[]) =>
  ` ${fold(texts.join(' ')).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;

function loadCatalog(fetchImpl: Fetch) {
  const cached = catalogs.get(fetchImpl);
  if (cached && Date.now() - cached.at < DAY) return cached.entries;
  const entries = ckan<{ count: number; results: Package[] }>(fetchImpl, 'package_search', {
    rows: '1000',
  }).then(({ count, results }) => {
    // Més conjunts que una pàgina: buscar-ne una part els faria desaparèixer sense avís.
    if (results.length < count)
      throw new SourceError(
        `El catàleg té ${count} conjunts i només n'han arribat ${results.length}.`,
      );
    return results.map((p) => ({
      conjunt: summary(p),
      modified: p.metadata_modified,
      titles: searchable(p.title, p.title_translated?.ca, p.title_translated?.es, p.name),
      rest: searchable(
        p.notes_translated?.ca,
        p.notes_translated?.es,
        p.tags?.map((t) => t.name).join(' '),
      ),
    }));
  });
  catalogs.set(fetchImpl, { at: Date.now(), entries });
  entries.catch(() => catalogs.delete(fetchImpl));
  return entries;
}

// «barris» troba «barri» i «barrios»: es busca el principi de cada paraula.
const stem = (word: string) => (word.length > 4 ? word.replace(/(es|s)$/, '') : word);
// Sense aquestes, «qualitat de l'aire» donaria per bona qualsevol descripció amb «del».
// «barcelona» i «ciutat» són a gairebé tots els títols («… de la ciutat de Barcelona»).
const STOPWORDS = new Set([
  ...['del', 'dels', 'les', 'per', 'amb', 'las', 'los', 'por', 'con', 'una'],
  ...['barcelona', 'ciutat', 'ciudad', 'city'],
]);

export async function cercarConjunt(fetchImpl: Fetch, q: string, limit: number) {
  const terms = words(q.replace(/[^\p{L}\p{N}\s]/gu, ' '))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((w) => ` ${stem(w)}`);
  if (terms.length === 0)
    throw new SourceError(
      "Busca pel tema, com «accidents» o «qualitat de l'aire»: «Barcelona» o «ciutat» són a gairebé tots els conjunts.",
    );
  const found = (await loadCatalog(fetchImpl))
    .map((e) => {
      const hits = terms.map((t) => (e.titles.includes(t) ? 2 : e.rest.includes(t) ? 1 : 0));
      return {
        e,
        matched: hits.filter(Boolean).length,
        score: hits.reduce<number>((a, b) => a + b, 0),
      };
    })
    .filter(({ matched }) => matched > 0)
    // Primer els que tenen més paraules de la cerca; després, al títol millor que al text.
    .sort(
      (a, b) =>
        b.matched - a.matched || b.score - a.score || b.e.modified.localeCompare(a.e.modified),
    );
  return {
    total: found.length,
    conjunts: found.slice(0, limit).map(({ e }) => e.conjunt),
  };
}

const period = (r: Resource) => {
  const match = /((?:19|20)\d{2})(?:[_-](\d{2})(?!\d))?/.exec(r.name);
  return match ? `${match[1]}${match[2] ?? '00'}` : '';
};

export async function veureConjunt(fetchImpl: Fetch, id: string, desDe = 0) {
  const p = await ckan<Package>(fetchImpl, 'package_show', { id });
  // Les sèries llargues tenen un recurs per any o per mes, sense ordre; i la data de creació no és
  // la del període (un fitxer de 2012 pujat el 2026). El període va al nom: 2026_03_Marc….
  const recursos = queryable(p).sort(
    (a, b) => period(b).localeCompare(period(a)) || b.created.localeCompare(a.created),
  );
  return {
    id: p.name,
    titol: title(p),
    descripcio: short(notes(p), 1500),
    organisme: p.organization?.title,
    font: p.fuente,
    llicencia: p.license_title,
    frequencia: p.frequency?.toLowerCase(),
    metadades_actualitzades: p.metadata_modified.slice(0, 10),
    recursos_consultables: recursos.length,
    recursos: recursos.slice(desDe, desDe + MAX_RECURSOS).map((r) => ({
      id: r.id,
      nom: r.name,
      format: r.format,
      creat: r.created.slice(0, 10),
    })),
    ...(recursos.length === 0 && {
      nota:
        p.token_required === 'Yes'
          ? 'Aquest conjunt només es baixa amb un token del portal: no es pot consultar aquí.'
          : 'Aquest conjunt no té recursos consultables fila a fila; es baixa des del portal.',
    }),
  };
}

export async function consultarDades(
  fetchImpl: Fetch,
  args: {
    recurs: string;
    filtres?: Record<string, string | number | (string | number)[]>;
    q?: string;
    camps?: string[];
    ordre?: string;
    limit: number;
    des_de: number;
  },
) {
  const params: Record<string, string> = {
    resource_id: args.recurs,
    // Amb limit=0 el portal no dona el total: se'n demana una fila com a mínim i no es torna.
    limit: String(Math.max(args.limit, 1)),
    offset: String(args.des_de),
  };
  if (args.filtres) params.filters = JSON.stringify(args.filtres);
  if (args.q) params.q = args.q;
  if (args.camps) params.fields = args.camps.join(',');
  if (args.ordre) params.sort = args.ordre;
  const result = await ckan<{
    total?: number;
    fields: { id: string; type: string }[];
    records: Record<string, unknown>[];
  }>(fetchImpl, 'datastore_search', params);
  // Columnes del datastore, no del recurs: `rank` i `_full_count` només surten en buscar amb `q`.
  const internal = new Set(args.q ? ['_id', 'rank', '_full_count'] : ['_id']);
  const camps = result.fields.filter((f) => !internal.has(f.id)).map((f) => `${f.id} (${f.type})`);
  const files = result.records
    .slice(0, args.limit)
    .map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !internal.has(k))));
  if (result.total !== undefined) return { total: result.total, camps, files };
  // Sense files el portal tampoc dona el total. Des del principi, vol dir que cap compleix la consulta.
  if (result.records.length > 0 || args.des_de > 0)
    throw new SourceError(
      args.des_de > 0
        ? `No hi ha files a partir de la ${args.des_de}: demana des de 0 per saber-ne el total.`
        : 'La font no ha donat el total de files.',
    );
  return {
    total: 0,
    camps,
    files,
    nota: 'Cap fila compleix la consulta. Els filtres demanen el valor exacte, amb accents i majúscules («Gràcia», no «Gracia»): mira els valors amb unes quantes files sense filtrar.',
  };
}

export function createBarcelonaServer(fetchImpl: Fetch = fetch) {
  const s = new McpServer(
    { name: 'finestreta-oberta-barcelona', title: 'Open Data BCN', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );
  s.registerTool(
    'cercar_conjunt',
    {
      title: 'Cercar un conjunt',
      description:
        "Els conjunts de dades de l'Ajuntament de Barcelona el títol, la descripció o les etiquetes dels quals contenen alguna de les paraules de `q` (en català o en castellà, sense distingir accents), primer els que més hi coincideixen, amb quants recursos es poden consultar fila a fila.",
      inputSchema: z.object({
        q: z.string().min(2).max(100),
        limit: z.number().int().min(1).max(30).default(10),
      }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ q, limit }) => run(SOURCE, () => cercarConjunt(fetchImpl, q, limit)),
  );
  s.registerTool(
    'veure_conjunt',
    {
      title: 'Veure un conjunt',
      description: `La descripció, l'organisme, la llicència i la freqüència d'un conjunt, i els seus recursos consultables del període més recent al més antic (per l'any i el mes del nom), de ${MAX_RECURSOS} en ${MAX_RECURSOS} (\`des_de\` salta els més recents, per arribar als anys antics), amb l'id que fa servir consultar_dades.`,
      inputSchema: z.object({
        id: z.string().min(1).max(120).describe('Id del conjunt, de cercar_conjunt.'),
        des_de: z.number().int().min(0).default(0).describe('Recursos que cal saltar.'),
      }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ id, des_de }) => run(SOURCE, () => veureConjunt(fetchImpl, id, des_de)),
  );
  s.registerTool(
    'consultar_dades',
    {
      title: 'Consultar dades',
      description:
        "Les files d'un recurs, amb els seus camps i el total de files que compleixen la consulta. Amb limit 0 només en dona els camps. Els números arriben com a text.",
      inputSchema: z.object({
        recurs: z.uuid().describe('Id del recurs, de veure_conjunt.'),
        filtres: z
          .record(
            z.string().max(80),
            z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]),
          )
          .optional()
          .describe(
            'Camp → valor exacte, amb accents i majúscules, o llista de valors, com {"Nom_Districte": "Gràcia"}.',
          ),
        q: z.string().max(100).optional().describe('Text per buscar a totes les columnes.'),
        camps: z.array(z.string().max(80)).max(30).optional().describe('Només aquests camps.'),
        ordre: z
          .string()
          .max(120)
          .optional()
          .describe('Camp i sentit, com «Any desc» o «Valor asc».'),
        limit: z.number().int().min(0).max(100).default(20),
        des_de: z.number().int().min(0).default(0).describe('Files que cal saltar, per paginar.'),
      }),
      annotations: READ_ONLY_EXTERNAL,
    },
    (args) => run(SOURCE, () => consultarDades(fetchImpl, args)),
  );
  return s;
}
