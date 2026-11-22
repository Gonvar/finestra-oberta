// Servidor MCP de l'Idescat (Institut d'Estadística de Catalunya): les taules del seu banc de dades
// per l'API Taules v2 (https://api.idescat.cat/taules/v2), sense clau. No hi ha cap llista plana de
// taules: és un arbre estadística → node → taula → àmbit territorial, i cada fulla torna JSON-stat.
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  fold,
  getJson,
  matches,
  READ_ONLY_EXTERNAL,
  run,
  SourceError,
  words,
  type Fetch,
} from './comun.ts';

const API = 'https://api.idescat.cat/taules/v2';
const SOURCE =
  "Font: Idescat, Institut d'Estadística de Catalunya (idescat.cat). Cita'l quan facis servir les dades.";
// Una taula per municipis sense filtrar passa de 100.000 dades: més que això no serveix a l'assistent.
export const MAX_DADES = 1000;

const INSTRUCTIONS = `Estadístiques oficials de l'Idescat: població (padró), naixements, mercat de treball, renda, economia, usos lingüístics, turisme… de Catalunya, les seves províncies, comarques i municipis.
Les taules es troben en un arbre. Amb explorar, ves baixant: sense camí surten les estadístiques; amb «pmh», els seus temes; amb «pmh/446», les taules; amb «pmh/446/477», els àmbits territorials (Catalunya, comarques, municipis…). Un camí complet com «pmh/446/477/com» és una taula: mira'n les dimensions amb veure_taula i demana'n les dades amb dades_taula, filtrant cada dimensió per paraules dels seus valors.
Alguns temes tenen diverses taules per períodes, com «(2014–)» i «(2000–2013)»: fes servir la que arriba fins avui si no et demanen anys antics.
Digues sempre a quin període correspon cada dada; un valor null és una dada que no existeix o no es publica, mai un zero. Explica les notes de la taula quan afectin la resposta (per exemple, canvis de límits comarcals).
${SOURCE}`;

const segment = z.string().regex(/^[a-z0-9_]+$/i);
const cami = z
  .string()
  .max(80)
  .refine((c) => c.split('/').every((s) => segment.safeParse(s).success), 'Camí no vàlid.');
const camiTaula = cami
  .refine((c) => c.split('/').length === 4, 'Una taula té quatre parts, com pmh/446/477/com.')
  .describe("Camí d'una taula, d'explorar, com pmh/446/477/com.");

type Collection = {
  label: string;
  link?: { item?: { href: string; label: string }[] };
};

/** El camí relatiu d'un enllaç de l'API: «https://api.idescat.cat/taules/v2/pmh/446?lang=ca» → «pmh/446». */
const relative = (href: string) => new URL(href).pathname.replace(/^\/taules\/v2\/?/, '');

export async function explorar(fetchImpl: Fetch, path = '', q?: string) {
  if (path.split('/').length > 3)
    throw new SourceError('Aquest camí ja és una taula: fes servir veure_taula o dades_taula.');
  const data = await getJson<Collection>(fetchImpl, `${API}/${path}?lang=ca`);
  const w = words(q);
  const items = (data.link?.item ?? []).filter((i) => matches(i.label, w));
  return {
    titol: data.label,
    elements: items.map((i) => ({ cami: relative(i.href), nom: i.label })),
  };
}

type Category = { index: string[] | Record<string, number>; label: Record<string, string> };
type Meta = {
  label: string;
  updated: string;
  note?: string[];
  id: string[];
  size: number[];
  role: { time?: string[]; geo?: string[]; metric?: string[] };
  dimension: Record<string, { label: string; category: Category }>;
  extension?: { source?: string[]; status?: { label: Record<string, string> } };
};
type Data = Meta & {
  value: (number | null)[];
  // JSON-stat: un sol codi per a totes les cel·les, una llista, o només les cel·les que en tenen.
  status?: string | string[] | Record<string, string>;
};

/** Els codis d'una dimensió en ordre: l'Idescat dona l'índex com a llista, però JSON-stat admet objecte. */
const codes = ({ index }: Category) =>
  Array.isArray(index)
    ? index
    : Object.entries(index)
        .sort(([, a], [, b]) => a - b)
        .map(([code]) => code);

const meta = (fetchImpl: Fetch, path: string) =>
  getJson<Meta>(fetchImpl, `${API}/${path}?lang=ca`);

export async function veureTaula(fetchImpl: Fetch, path: string) {
  const m = await meta(fetchImpl, path);
  const time = m.role.time?.[0];
  return {
    titol: m.label,
    actualitzada: m.updated,
    font: m.extension?.source,
    notes: m.note,
    dimensions: m.id.map((id) => {
      const { label, category } = m.dimension[id]!;
      const all = codes(category).map((codi) => ({ codi, nom: category.label[codi]! }));
      return {
        id,
        nom: label,
        periode: id === time || undefined,
        total: all.length,
        // Del període n'hi ha prou amb els últims; dels municipis, una mostra: dades_taula filtra per text.
        valors: id === time ? all.slice(-12) : all.slice(0, 60),
      };
    }),
  };
}

/** Els codis d'una dimensió que vol el filtre: el valor exacte (nom o codi) si n'hi ha, si no els que contenen les paraules. */
function select(id: string, category: Category, filtre: string) {
  const all = codes(category);
  const exact = all.filter((c) => fold(category.label[c]!) === fold(filtre) || c === filtre);
  if (exact.length) return exact;
  const w = words(filtre);
  const found = all.filter((c) => matches(category.label[c]!, w));
  if (!found.length)
    throw new SourceError(
      `Cap valor de «${id}» conté «${filtre}». Mira'n els valors amb veure_taula.`,
    );
  return found;
}

function statusOf(data: Data, cell: number) {
  const { status } = data;
  const code =
    typeof status === 'string' ? status : Array.isArray(status) ? status[cell] : status?.[cell];
  return code === undefined ? undefined : (data.extension?.status?.label[code] ?? code);
}

/**
 * Una sèrie per combinació de valors, amb les dades del període més recent al més antic. Una
 * dimensió que a la taula sencera (`m`) té un sol valor és la mateixa per a totes: no entra al nom.
 */
function series(m: Meta, data: Data) {
  const time = data.role.time?.[0];
  const labels = data.id.map((id) => {
    const category = data.dimension[id]!.category;
    return codes(category).map((c) => category.label[c]!);
  });
  // Cada dada amb la posició del seu període: l'índex és cronològic, les etiquetes («T2/2026») no s'ordenen com a text.
  const bySeries = new Map<
    string,
    { pos: number; dada: { periode: string | undefined; valor: number | null; estat?: string } }[]
  >();
  data.value.forEach((valor, cell) => {
    let rest = cell;
    const name: string[] = [];
    let periode: string | undefined;
    let pos = 0;
    for (let d = data.id.length - 1; d >= 0; d--) {
      const size = data.size[d]!;
      const label = labels[d]![rest % size]!;
      if (data.id[d] === time) [periode, pos] = [label, rest % size];
      else if (m.size[m.id.indexOf(data.id[d]!)]! > 1) name.unshift(label);
      rest = Math.floor(rest / size);
    }
    const key = name.join(' · ') || data.label;
    const dades = bySeries.get(key) ?? [];
    dades.push({ pos, dada: { periode, valor, estat: statusOf(data, cell) } });
    bySeries.set(key, dades);
  });
  return {
    taula: data.label,
    actualitzada: data.updated,
    notes: data.note,
    series: [...bySeries].map(([nom, dades]) => ({
      nom,
      dades: dades.sort((a, b) => b.pos - a.pos).map((d) => d.dada),
    })),
  };
}

export async function dadesTaula(
  fetchImpl: Fetch,
  path: string,
  ultims: number,
  filtres: Record<string, string> = {},
) {
  const m = await meta(fetchImpl, path);
  const time = m.role.time?.[0];
  const dimensionOf = (nom: string) =>
    m.id.find((id) => fold(id) === fold(nom) || fold(m.dimension[id]!.label) === fold(nom));
  const params = new URLSearchParams({ lang: 'ca' });
  let total = 1;
  for (const [nom, filtre] of Object.entries(filtres)) {
    const id = dimensionOf(nom);
    if (!id)
      throw new SourceError(
        `La taula no té la dimensió «${nom}». Les seves dimensions: ${m.id.map((id) => `${id} (${m.dimension[id]!.label})`).join(', ')}.`,
      );
    if (id === time)
      throw new SourceError(
        `«${id}» no es filtra: demana els últims períodes amb \`ultims\` i tria'n.`,
      );
    // L'API respon 200 amb un codi que no existeix: el filtre es resol aquí perquè no torni dades buides.
    params.set(id, select(id, m.dimension[id]!.category, filtre).join(','));
  }
  m.id.forEach((id, d) => {
    if (id === time) total *= Math.min(ultims, m.size[d]!);
    else total *= params.get(id)?.split(',').length ?? m.size[d]!;
  });
  if (total > MAX_DADES)
    throw new SourceError(
      `La consulta demana ${total} dades i el màxim és ${MAX_DADES}: filtra més dimensions amb \`filtres\` o demana menys períodes.`,
    );
  if (time) params.set('_LAST_', String(ultims));
  return series(m, await getJson<Data>(fetchImpl, `${API}/${path}/data?${params}`));
}

export function createIdescatServer(fetchImpl: Fetch = fetch) {
  const s = new McpServer(
    { name: 'finestreta-oberta-idescat', title: 'Idescat', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );
  s.registerTool(
    'explorar',
    {
      title: "Explorar l'Idescat",
      description:
        "Un nivell de l'arbre de taules: sense `cami`, les estadístiques; amb un camí, el que hi ha a dins (temes, taules o àmbits territorials). `q` filtra els noms per paraules.",
      inputSchema: z.object({
        cami: cami.optional().describe('Camí d’un element anterior, com pmh o pmh/446.'),
        q: z.string().max(100).optional(),
      }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ cami, q }) => run(SOURCE, () => explorar(fetchImpl, cami, q)),
  );
  s.registerTool(
    'veure_taula',
    {
      title: 'Veure una taula',
      description:
        "Les dimensions d'una taula i els seus valors (els 60 primers; del període, els 12 últims), la data d'actualització i les notes, per saber com filtrar dades_taula.",
      inputSchema: z.object({ cami: camiTaula }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ cami }) => run(SOURCE, () => veureTaula(fetchImpl, cami)),
  );
  s.registerTool(
    'dades_taula',
    {
      title: "Dades d'una taula",
      description: `Les dades d'una taula en els seus últims períodes. \`filtres\` tria, per a cada dimensió, els valors que contenen aquelles paraules (o el seu codi), com {"COM": "Osona", "SEX": "dones"}; una dimensió sense filtre va sencera. Com a màxim ${MAX_DADES} dades.`,
      inputSchema: z.object({
        cami: camiTaula,
        filtres: z
          .record(z.string().max(80), z.string().max(100))
          .optional()
          .describe('Dimensió (id o nom, com a veure_taula) → paraules dels valors que es volen.'),
        ultims: z
          .number()
          .int()
          .min(1)
          .max(60)
          .default(1)
          .describe('Quants períodes, del més recent cap enrere.'),
      }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ cami, filtres, ultims }) => run(SOURCE, () => dadesTaula(fetchImpl, cami, ultims, filtres)),
  );
  return s;
}
