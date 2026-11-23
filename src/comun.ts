// Adaptat de packages/mcp/src/comun.ts de Reforma Digital (https://github.com/samuelcorsan/reforma-digital),
// llicència MIT. El que comparteixen els servidors MCP que consulten una API pública: eines de
// només lectura i errors sense detalls interns.

export const READ_ONLY_EXTERNAL = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** Un error de la font que sí que es pot explicar a l'assistent. */
export class SourceError extends Error {}

export type Fetch = typeof fetch;

export const TEMPS_LIMIT_MS = 20_000;

/** GET amb temps límit: la resposta si és 2xx; si no, un SourceError amb el codi. */
async function get(fetchImpl: Fetch, url: string, accept: string) {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: accept },
      signal: AbortSignal.timeout(TEMPS_LIMIT_MS),
    });
  } catch {
    throw new SourceError('La font no respon. Torna-ho a provar més tard.');
  }
  if (!response.ok) throw new SourceError(`La font ha respost ${response.status}.`);
  return response;
}

export async function getJson<T>(fetchImpl: Fetch, url: string) {
  return (await (await get(fetchImpl, url, 'application/json')).json()) as T;
}

/** Dades obertes de Catalunya, la plataforma Socrata de la Generalitat. */
export const SOCRATA = 'https://analisi.transparenciacatalunya.cat';

type Meta = { name: string; rowsUpdatedAt: number; attribution: string };
export const metadades = (fetchImpl: Fetch, id: string) =>
  getJson<Meta>(fetchImpl, `${SOCRATA}/api/views/${id}.json`);
/** El dia de l'última actualització de les files d'un conjunt, no el de la consulta. */
export const dia = (meta: Meta) => new Date(meta.rowsUpdatedAt * 1000).toISOString().slice(0, 10);

export type Fila = Record<string, unknown>;

/** Socrata omet els camps nuls: un camp que falta és null, i un d'obligatori que falta, un error. */
export function camp(fila: Fila, nom: string): string | null {
  const valor = fila[nom];
  if (valor === undefined) return null;
  if (typeof valor !== 'string') throw new SourceError(`El camp ${nom} no és text: ${valor}.`);
  return valor;
}

export function obligatori(fila: Fila, nom: string, conjunt: string) {
  const valor = camp(fila, nom);
  if (valor === null || valor.trim() === '')
    throw new SourceError(`Una fila de ${conjunt} no té ${nom}.`);
  return valor;
}

/** Un nombre natural escrit com a text, com els dona Socrata. Una cadena buida no és un zero. */
export function numero(text: string, nom: string) {
  if (!/^\d+$/.test(text)) throw new SourceError(`${nom} no és un nombre: ${text}.`);
  return Number(text);
}

/**
 * Els sis primers dígits dels codis d'ens de Municat són el codi del municipi de l'INE amb el dígit
 * de control, el mateix que fa servir l'Idescat. És el que lliga les fonts dels municipis.
 */
export function codiMunicipi(codi: string) {
  if (!/^\d{10}$/.test(codi)) throw new SourceError(`Codi d'ens inesperat: ${codi}.`);
  return codi.slice(0, 6);
}

export const LIMIT_SOCRATA = 50_000;

/** Totes les files d'una consulta en una sola pàgina: si no hi caben, falla en lloc de tallar-les. */
export async function filesSocrata(fetchImpl: Fetch, id: string, params: Record<string, string>) {
  const resultat = await getJson<Fila[]>(
    fetchImpl,
    `${SOCRATA}/resource/${id}.json?${new URLSearchParams({ ...params, $limit: String(LIMIT_SOCRATA) })}`,
  );
  if (resultat.length === LIMIT_SOCRATA)
    throw new SourceError(`El conjunt ${id} no cap en una pàgina.`);
  return resultat;
}

/** Per a les fonts que només publiquen pàgines web, com el Parlament. */
export async function getText(fetchImpl: Fetch, url: string) {
  return (await get(fetchImpl, url, 'text/html')).text();
}

const ENTITATS: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  lt: '<',
  gt: '>',
};

/** El text d'un tros d'HTML, per a les fonts que només publiquen pàgines web. Una entitat desconeguda és un error: no es pot endevinar. */
export function text(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&([#\w]+);/g, (whole, name: string) => {
      // Una entitat numèrica diu el caràcter exacte: es pot llegir sense endevinar res.
      const numero = name.match(/^#(?:x([0-9a-f]+)|(\d+))$/i);
      if (numero)
        return String.fromCodePoint(parseInt(numero[1] ?? numero[2]!, numero[1] ? 16 : 10));
      const value = ENTITATS[name];
      if (value === undefined) throw new SourceError(`Entitat HTML desconeguda: ${whole}.`);
      return value;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function comprovaCodificacio(html: string, url: string) {
  if (html.includes('�')) throw new SourceError(`${url} té caràcters mal codificats.`);
}

/** Executa una eina: el resultat en JSON amb la font al final, o l'error per a l'assistent. */
export async function run<T>(source: string, produce: () => Promise<T>) {
  try {
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(await produce(), null, 2) },
        { type: 'text' as const, text: source },
      ],
    };
  } catch (error) {
    // Només els errors de la font porten el seu missatge: un altre podria portar URL o dades internes.
    const message =
      error instanceof SourceError ? error.message : 'Error intern en consultar la font.';
    return { content: [{ type: 'text' as const, text: message }], isError: true };
  }
}

/** Sense accents ni majúscules, per trobar «Lluçanes» o «emporda». */
export const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Les paraules d'una cerca, per a `matches`. */
export const words = (q: string | undefined) =>
  fold(q ?? '')
    .split(/\s+/)
    .filter(Boolean);

/** Si el text conté totes les paraules, en qualsevol ordre. */
export const matches = (text: string, q: string[]) => q.every((w) => fold(text).includes(w));
