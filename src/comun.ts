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

/** GET amb temps límit: el JSON si la resposta és 2xx; si no, un SourceError amb el codi. */
export async function getJson<T>(fetchImpl: Fetch, url: string) {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SourceError('La font no respon. Torna-ho a provar més tard.');
  }
  if (!response.ok) throw new SourceError(`La font ha respost ${response.status}.`);
  return (await response.json()) as T;
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
