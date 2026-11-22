// La procedència de les dades publicades: cada resposta de les fonts oficials es desa tal com va
// arribar, amb l'URL, l'hora i l'empremta SHA-256. Amb aquestes còpies qualsevol persona pot tornar
// a generar els JSON i comprovar que surten idèntics, sense haver de confiar en qui els publica.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Fetch } from './comun.ts';

/**
 * Una resposta d'una font oficial, tal com va arribar. El cos és a captures/<sha256>. `url` és
 * l'adreça demanada i `url_resposta`, la que va servir els bytes després de les redireccions.
 */
export type Captura = {
  url: string;
  url_resposta: string;
  consultat: string;
  estat: number;
  tipus: string | null;
  sha256: string;
};

/**
 * `fitxers` és l'empremta de cada JSON publicat. L'atestació signa aquest fitxer, de manera que
 * lliga els JSON i les còpies d'una mateixa execució: no se'n poden barrejar de dues.
 */
export type Procedencia = {
  data_consulta: string;
  fitxers: Record<string, string>;
  captures: Captura[];
};

// Sense zod: la tasca de dades no instal·la cap dependència (vegeu .github/workflows/dades.yml).
const esEmpremta = (x: unknown) => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);

const esCaptura = (c: Record<string, unknown>) =>
  typeof c.url === 'string' &&
  typeof c.url_resposta === 'string' &&
  typeof c.consultat === 'string' &&
  typeof c.estat === 'number' &&
  (typeof c.tipus === 'string' || c.tipus === null) &&
  esEmpremta(c.sha256);

const esProcedencia = (p: Record<string, unknown>): p is Procedencia =>
  typeof p.data_consulta === 'string' &&
  typeof p.fitxers === 'object' &&
  p.fitxers !== null &&
  Object.values(p.fitxers).every(esEmpremta) &&
  Array.isArray(p.captures) &&
  p.captures.every((c) => typeof c === 'object' && c !== null && esCaptura(c));

/** Llegeix les fonts amb `fetchImpl` i torna cada fitxer JSON que s'ha de publicar, pel seu nom. */
export type Construeix<T extends Record<string, unknown> = Record<string, unknown>> = (
  fetchImpl: Fetch,
  data: string,
  pausaMs: number,
) => Promise<T>;

const empremta = (cos: Uint8Array) => createHash('sha256').update(cos).digest('hex');

export const serialitza = (dades: unknown) => `${JSON.stringify(dades, null, 2)}\n`;

/**
 * Genera les dades des de les fonts i les desa a `carpeta` amb la còpia de cada resposta. Només
 * escriu quan `construeix` ha acabat bé, perquè una font que falla no deixi la carpeta a mitges.
 */
export async function genera<T extends Record<string, unknown>>(
  carpeta: string,
  fetchImpl: Fetch,
  data: string,
  construeix: Construeix<T>,
  pausaMs = 300,
) {
  const captures: Captura[] = [];
  const cossos = new Map<string, Uint8Array>();
  const enregistrat: Fetch = async (input, init) => {
    const resposta = await fetchImpl(input, init);
    const cos = new Uint8Array(await resposta.arrayBuffer());
    const sha256 = empremta(cos);
    captures.push({
      url: String(input),
      url_resposta: resposta.url,
      consultat: new Date().toISOString(),
      estat: resposta.status,
      tipus: resposta.headers.get('content-type'),
      sha256,
    });
    cossos.set(sha256, cos);
    return new Response(cos, { status: resposta.status, headers: resposta.headers });
  };
  const fitxers = await construeix(enregistrat, data, pausaMs);

  // Les còpies d'una actualització anterior ja no corresponen a aquestes dades.
  await rm(join(carpeta, 'captures'), { recursive: true, force: true });
  await mkdir(join(carpeta, 'captures'), { recursive: true });
  for (const [sha256, cos] of cossos) await writeFile(join(carpeta, 'captures', sha256), cos);
  const empremtes: Record<string, string> = {};
  for (const [nom, dades] of Object.entries(fitxers)) {
    const text = serialitza(dades);
    empremtes[nom] = empremta(new TextEncoder().encode(text));
    await writeFile(join(carpeta, nom), text);
  }
  const procedencia: Procedencia = { data_consulta: data, fitxers: empremtes, captures };
  await writeFile(join(carpeta, 'procedencia.json'), serialitza(procedencia));
  return fitxers;
}

/** Una carpeta de dades que no es correspon amb les seves còpies de les fonts. */
export class DesquadreError extends Error {}

/**
 * Comprova que les còpies tenen l'empremta que diu procedencia.json i que, tornant a construir les
 * dades a partir d'aquestes còpies, els JSON publicats surten idèntics, byte a byte.
 */
export async function verifica(carpeta: string, construeix: Construeix) {
  const llegeix = async (...cami: string[]) => {
    try {
      return await readFile(join(carpeta, ...cami));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      throw new DesquadreError(`Falta ${join(carpeta, ...cami)}.`);
    }
  };
  const procedencia = JSON.parse(String(await llegeix('procedencia.json'))) as Record<
    string,
    unknown
  >;
  if (!esProcedencia(procedencia))
    throw new DesquadreError('procedencia.json no té la forma esperada.');
  const cossos = await Promise.all(
    procedencia.captures.map(async (captura) => {
      const cos = new Uint8Array(await llegeix('captures', captura.sha256));
      if (empremta(cos) !== captura.sha256)
        throw new DesquadreError(
          `La còpia de ${captura.url} no té l'empremta que diu procedencia.json.`,
        );
      return cos;
    }),
  );

  // Les respostes es tornen a servir en el mateix ordre en què es van demanar.
  let seguent = 0;
  let desquadre: DesquadreError | undefined;
  const reproduit: Fetch = async (input) => {
    const captura = procedencia.captures[seguent];
    if (captura === undefined || captura.url !== String(input)) {
      desquadre = new DesquadreError(
        `Les dades demanen ${String(input)}, però la còpia següent és ${captura === undefined ? 'cap' : `de ${captura.url}`}.`,
      );
      throw desquadre;
    }
    return new Response(cossos[seguent++], { status: captura.estat });
  };
  let fitxers;
  try {
    fitxers = await construeix(reproduit, procedencia.data_consulta, 0);
  } catch (error) {
    // comun.ts converteix qualsevol error de fetch en «la font no respon», que aquí no és la causa.
    if (desquadre) throw desquadre;
    throw error;
  }
  if (seguent !== procedencia.captures.length)
    throw new DesquadreError(
      `procedencia.json té ${procedencia.captures.length} còpies, però les dades només en fan servir ${seguent}.`,
    );

  const noms = Object.keys(fitxers);
  if (JSON.stringify(Object.keys(procedencia.fitxers).sort()) !== JSON.stringify([...noms].sort()))
    throw new DesquadreError(`procedencia.json no dona l'empremta de ${noms.join(' i ')}.`);
  for (const [nom, dades] of Object.entries(fitxers)) {
    const publicat = await llegeix(nom);
    if (String(publicat) !== serialitza(dades))
      throw new DesquadreError(`${nom} no és el que surt de les còpies de les fonts.`);
    if (empremta(publicat) !== procedencia.fitxers[nom])
      throw new DesquadreError(`${nom} no té l'empremta que diu procedencia.json.`);
  }
  return { procedencia, fitxers: Object.keys(fitxers) };
}
