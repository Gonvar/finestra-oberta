// La procedència de les dades publicades: cada resposta de les fonts oficials es desa tal com va
// arribar, amb l'URL, l'hora i l'empremta SHA-256. Amb aquestes còpies qualsevol persona pot tornar
// a generar els JSON i comprovar que surten idèntics, sense haver de confiar en qui els publica.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TEMPS_LIMIT_MS, type Fetch } from './comun.ts';

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
  /** L'ordre dels grups depèn de les dades ICU de cada versió: per reproduir-ho, la mateixa. */
  node: string;
  fitxers: Record<string, string>;
  captures: Captura[];
};

// Sense zod: la tasca de dades no instal·la cap dependència (vegeu .github/workflows/dades.yml).
const esEmpremta = (x: unknown) => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);

const esCaptura = (c: Record<string, unknown>) =>
  typeof c.url === 'string' &&
  typeof c.url_resposta === 'string' &&
  typeof c.consultat === 'string' &&
  // Només es publica a partir de respostes 2xx; qualsevol altre codi és una còpia manipulada.
  Number.isInteger(c.estat) &&
  (c.estat as number) >= 200 &&
  (c.estat as number) < 300 &&
  (typeof c.tipus === 'string' || c.tipus === null) &&
  esEmpremta(c.sha256);

const esProcedencia = (p: Record<string, unknown>): p is Procedencia =>
  typeof p.data_consulta === 'string' &&
  typeof p.node === 'string' &&
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

const INTENTS = 3;

/** Una connexió tallada o un temps límit vençut: no hi ha resposta sencera de la font. */
const esTall = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError'));

/**
 * Les fonts oficials de tant en tant tallen una connexió, o responen 429 o 5xx, quan s'hi fan desenes
 * de consultes seguides. En aquests casos es torna a provar, i només es desa l'última resposta, amb
 * el cos sencer. L'URL va a stderr perquè el registre de la tasca digui quina font ha fallat.
 */
async function consultaAmbReintents(
  fetchImpl: Fetch,
  input: Parameters<Fetch>[0],
  init: RequestInit | undefined,
  pausaMs: number,
) {
  // Una URL mal formada és un error del codi, no de la font: no es torna a provar.
  new URL(String(input));
  for (let intent = 1; ; intent++) {
    try {
      // Cada intent té el seu temps límit, el mateix que comun.ts: el del primer ja pot haver vençut.
      const resposta = await fetchImpl(input, {
        ...init,
        signal: AbortSignal.timeout(TEMPS_LIMIT_MS),
      });
      const cos = new Uint8Array(await resposta.arrayBuffer());
      const transitori = resposta.status === 429 || resposta.status >= 500;
      if (!transitori || intent === INTENTS) return { resposta, cos };
      console.error(
        `${String(input)} ha respost ${resposta.status} (intent ${intent} de ${INTENTS}).`,
      );
    } catch (error) {
      if (!esTall(error)) throw error;
      console.error(`${String(input)} no ha respost (intent ${intent} de ${INTENTS}).`);
      if (intent === INTENTS) throw error;
    }
    await new Promise((resol) => setTimeout(resol, pausaMs * 10 * intent));
  }
}

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
    const { resposta, cos } = await consultaAmbReintents(fetchImpl, input, init, pausaMs);
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

  // Les còpies i els JSON d'una actualització anterior ja no corresponen a aquestes dades. Abans
  // d'esborrar-los, es comprova que la carpeta només té dades: una altra carpeta perdria fitxers.
  // `.git` és el de la branca `dades` quan la carpeta n'és un worktree.
  await mkdir(carpeta, { recursive: true });
  const aliens = (await readdir(carpeta)).filter(
    (nom) => nom !== '.git' && nom !== 'captures' && !nom.endsWith('.json'),
  );
  if (aliens.length > 0) {
    throw new Error(`${carpeta} no és una carpeta de dades: hi ha ${aliens.join(', ')}.`);
  }
  await rm(join(carpeta, 'captures'), { recursive: true, force: true });
  await mkdir(join(carpeta, 'captures'), { recursive: true });
  for (const nom of await readdir(carpeta)) if (nom.endsWith('.json')) await rm(join(carpeta, nom));
  for (const [sha256, cos] of cossos) await writeFile(join(carpeta, 'captures', sha256), cos);
  const empremtes: Record<string, string> = {};
  for (const [nom, dades] of Object.entries(fitxers)) {
    const text = serialitza(dades);
    empremtes[nom] = empremta(new TextEncoder().encode(text));
    await writeFile(join(carpeta, nom), text);
  }
  const procedencia: Procedencia = {
    data_consulta: data,
    node: process.version,
    fitxers: empremtes,
    captures,
  };
  await writeFile(join(carpeta, 'procedencia.json'), serialitza(procedencia));
  return fitxers;
}

/** Una carpeta de dades que no es correspon amb les seves còpies de les fonts. */
export class DesquadreError extends Error {}

/**
 * Construeix les dades a partir de les còpies de `carpeta` en lloc de les fonts: cada crida rep la
 * còpia següent, en el mateix ordre en què es va demanar. Falla amb DesquadreError si les còpies no
 * tenen l'empremta que diu procedencia.json, o si `construeix` no demana exactament aquestes URL.
 */
async function reprodueixCopies<T extends Record<string, unknown>>(
  carpeta: string,
  construeix: (fetchImpl: Fetch, data: string) => Promise<T>,
) {
  const llegeix = async (...cami: string[]) => {
    try {
      return await readFile(join(carpeta, ...cami));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      throw new DesquadreError(`Falta ${join(carpeta, ...cami)}.`);
    }
  };
  let llegit: unknown;
  try {
    llegit = JSON.parse(String(await llegeix('procedencia.json')));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new DesquadreError('procedencia.json no és JSON vàlid.');
  }
  if (typeof llegit !== 'object' || llegit === null)
    throw new DesquadreError('procedencia.json no té la forma esperada.');
  const procedencia = llegit as Record<string, unknown>;
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

  let seguent = 0;
  let desquadre: DesquadreError | undefined;
  // Les còpies només guarden l'URL de cada petició, no el mètode ni el cos: una petició que no sigui
  // un GET sense cos no es pot servir des d'una còpia.
  const reproduit: Fetch = async (input, init) => {
    const captura = procedencia.captures[seguent];
    if (init !== undefined && ((init.method !== undefined && init.method !== 'GET') || init.body)) {
      desquadre = new DesquadreError(
        `Les dades fan un ${init.method} a ${String(input)}, i les còpies només són de GET.`,
      );
      throw desquadre;
    }
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
    fitxers = await construeix(reproduit, procedencia.data_consulta);
  } catch (error) {
    // comun.ts converteix qualsevol error de fetch en «la font no respon», que aquí no és la causa.
    if (desquadre) throw desquadre;
    throw error;
  }
  if (seguent !== procedencia.captures.length)
    throw new DesquadreError(
      `procedencia.json té ${procedencia.captures.length} còpies, però les dades només en fan servir ${seguent}.`,
    );
  return { procedencia, fitxers, llegeix };
}

/**
 * Comprova que les còpies tenen l'empremta que diu procedencia.json i que, tornant a construir les
 * dades a partir d'aquestes còpies, els JSON publicats surten idèntics, byte a byte.
 */
export async function verifica(carpeta: string, construeix: Construeix) {
  const { procedencia, fitxers, llegeix } = await reprodueixCopies(carpeta, (fetchImpl, data) =>
    construeix(fetchImpl, data, 0),
  );
  const noms = Object.keys(fitxers);
  if (JSON.stringify(Object.keys(procedencia.fitxers).sort()) !== JSON.stringify([...noms].sort()))
    throw new DesquadreError(`procedencia.json no dona l'empremta de ${noms.join(' i ')}.`);
  for (const [nom, dades] of Object.entries(fitxers)) {
    const publicat = await llegeix(nom);
    if (String(publicat) !== serialitza(dades)) {
      // Una altra versió de Node pot ordenar els noms d'una altra manera: no vol dir que s'hagin tocat.
      const versio =
        procedencia.node === process.version
          ? ''
          : ` Les dades es van generar amb Node ${procedencia.node} i ara és ${process.version}: torna-ho a provar amb la mateixa versió.`;
      throw new DesquadreError(`${nom} no és el que surt de les còpies de les fonts.${versio}`);
    }
    if (empremta(publicat) !== procedencia.fitxers[nom])
      throw new DesquadreError(`${nom} no té l'empremta que diu procedencia.json.`);
  }
  return { procedencia, fitxers: Object.keys(fitxers) };
}

/**
 * Genera a `desti` les dades que surten de les còpies publicades a `origen`, amb el codi d'ara. La CI
 * ho fa servir per construir la web amb les dades d'una pull request sense tornar a consultar les
 * fonts. Falla amb DesquadreError si el codi d'ara no demana les mateixes URL que les còpies.
 */
export async function reprodueix(origen: string, desti: string, construeix: Construeix) {
  // Primer es comprova que el codi fa servir exactament les còpies, sense escriure res: genera buida
  // `desti`, i una reproducció que no quadra no l'ha de deixar a mitges.
  await reprodueixCopies(origen, (fetchImpl, data) => construeix(fetchImpl, data, 0));
  await reprodueixCopies(origen, (fetchImpl, data) =>
    genera(desti, fetchImpl, data, construeix, 0),
  );
  // genera hi desa una procedència amb l'hora d'ara i sense l'adreça de cada resposta. No és la de
  // cap consulta a les fonts, i no s'ha de poder confondre amb una.
  await rm(join(desti, 'procedencia.json'));
  await rm(join(desti, 'captures'), { recursive: true });
}
