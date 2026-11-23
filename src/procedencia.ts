// La procedència de les dades publicades: cada resposta de les fonts oficials es desa tal com va
// arribar, amb l'URL, l'hora i l'empremta SHA-256. Amb aquestes còpies qualsevol persona pot tornar
// a generar els JSON i comprovar que surten idèntics, sense haver de confiar en qui els publica.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SourceError, TEMPS_LIMIT_MS, type Fetch } from './comun.ts';

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
 * Les dades d'una font: l'empremta de cada JSON que en surt i les còpies de les respostes, en
 * l'ordre en què es van demanar. Si el dia de `data_consulta` la font no va respondre, `fallada` en
 * diu el dia i el missatge, i el grup és el de l'última vegada que sí que ho va fer.
 */
export type Grup = {
  data_consulta: string;
  /** L'ordre dels grups depèn de les dades ICU de cada versió: per reproduir-ho, la mateixa. */
  node: string;
  fitxers: Record<string, string>;
  captures: Captura[];
  fallada: { data: string; missatge: string } | null;
};

/**
 * Un grup per font. L'atestació signa aquest fitxer, de manera que lliga els JSON i les còpies de
 * cada font: no se'n poden barrejar de dues execucions.
 */
export type Procedencia = { grups: Record<string, Grup> };

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

const esObjecte = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const esGrup = (g: unknown): g is Grup =>
  esObjecte(g) &&
  typeof g.data_consulta === 'string' &&
  typeof g.node === 'string' &&
  esObjecte(g.fitxers) &&
  Object.values(g.fitxers).every(esEmpremta) &&
  Array.isArray(g.captures) &&
  g.captures.every((c) => esObjecte(c) && esCaptura(c)) &&
  (g.fallada === null ||
    (esObjecte(g.fallada) &&
      typeof g.fallada.data === 'string' &&
      typeof g.fallada.missatge === 'string'));

const esProcedencia = (p: unknown): p is Procedencia =>
  esObjecte(p) && esObjecte(p.grups) && Object.values(p.grups).every(esGrup);

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

/** Cada font, pel seu nom, amb la funció que en construeix els JSON. */
export type Fonts = Record<string, Construeix>;

type UnioAInterseccio<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void
  ? I
  : never;

/** Tots els JSON de totes les fonts, pel seu nom. */
export type Fitxers<F extends Fonts> = UnioAInterseccio<Awaited<ReturnType<F[keyof F]>>>;

/** Una carpeta de dades que no es correspon amb les seves còpies de les fonts. */
export class DesquadreError extends Error {}

async function llegeixCarpeta(carpeta: string) {
  const llegeix = async (...cami: string[]) => {
    try {
      return await readFile(join(carpeta, ...cami));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      throw new DesquadreError(`Falta ${join(carpeta, ...cami)}.`);
    }
  };
  let procedencia: unknown;
  try {
    procedencia = JSON.parse(String(await llegeix('procedencia.json')));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new DesquadreError('procedencia.json no és JSON vàlid.');
  }
  if (!esProcedencia(procedencia))
    throw new DesquadreError('procedencia.json no té la forma esperada.');
  return { procedencia, llegeix };
}

type Llegeix = Awaited<ReturnType<typeof llegeixCarpeta>>['llegeix'];

/**
 * Construeix les dades d'una font a partir de les seves còpies en lloc de la font: cada crida rep
 * la còpia següent, en el mateix ordre en què es va demanar. Falla amb DesquadreError si les còpies
 * no tenen l'empremta que diu procedencia.json, o si `construeix` no demana exactament aquestes URL.
 */
async function reprodueixGrup(
  llegeix: Llegeix,
  grup: Grup,
  construeix: (fetchImpl: Fetch, data: string) => Promise<Record<string, unknown>>,
) {
  const cossos = await Promise.all(
    grup.captures.map(async (captura) => {
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
    const captura = grup.captures[seguent];
    if (init !== undefined && ((init.method !== undefined && init.method !== 'GET') || init.body)) {
      desquadre = new DesquadreError(
        `Les dades fan una petició ${init.method === undefined ? 'GET amb cos' : init.method} a ${String(input)}, i les còpies només són de GET sense cos.`,
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
    fitxers = await construeix(reproduit, grup.data_consulta);
  } catch (error) {
    // comun.ts converteix qualsevol error de fetch en «la font no respon», que aquí no és la causa.
    if (desquadre) throw desquadre;
    throw error;
  }
  if (seguent !== grup.captures.length)
    throw new DesquadreError(
      `procedencia.json té ${grup.captures.length} còpies, però les dades només en fan servir ${seguent}.`,
    );
  return { fitxers, cossos };
}

/**
 * Comprova un grup publicat: tornant a construir-lo amb el codi d'ara a partir de les seves còpies,
 * els JSON surten idèntics, byte a byte, als publicats i a les empremtes de procedencia.json.
 */
async function verificaGrup(llegeix: Llegeix, nom: string, grup: Grup, construeix: Construeix) {
  const resultat = await reprodueixGrup(llegeix, grup, (fetchImpl, data) =>
    construeix(fetchImpl, data, 0),
  );
  const noms = Object.keys(resultat.fitxers);
  if (JSON.stringify(Object.keys(grup.fitxers).sort()) !== JSON.stringify([...noms].sort()))
    throw new DesquadreError(
      `procedencia.json no dona l'empremta de ${noms.join(' i ')} a la font ${nom}.`,
    );
  for (const [fitxer, dades] of Object.entries(resultat.fitxers)) {
    const publicat = await llegeix(fitxer);
    if (String(publicat) !== serialitza(dades)) {
      // Una altra versió de Node pot ordenar els noms d'una altra manera: no vol dir que s'hagin tocat.
      const versio =
        grup.node === process.version
          ? ''
          : ` Les dades es van generar amb Node ${grup.node} i ara és ${process.version}: torna-ho a provar amb la mateixa versió.`;
      throw new DesquadreError(`${fitxer} no és el que surt de les còpies de les fonts.${versio}`);
    }
    if (empremta(publicat) !== grup.fitxers[fitxer])
      throw new DesquadreError(`${fitxer} no té l'empremta que diu procedencia.json.`);
  }
  return resultat;
}

const mateixesFonts = (procedencia: Procedencia, fonts: Fonts) =>
  JSON.stringify(Object.keys(procedencia.grups).sort()) ===
  JSON.stringify(Object.keys(fonts).sort());

/**
 * Genera les dades de cada font i les desa a `carpeta` amb la còpia de cada resposta. Si una font no
 * respon, es manté el que se'n va publicar l'última vegada, amb el dia i el missatge de la fallada:
 * així una font caiguda no deixa sense actualitzar les altres. Si no se'n té cap versió anterior que
 * es pugui reproduir, o no respon cap font, no s'escriu res.
 */
export async function genera<F extends Fonts>(
  carpeta: string,
  fetchImpl: Fetch,
  data: string,
  fonts: F,
  pausaMs = 300,
) {
  let anterior: Awaited<ReturnType<typeof llegeixCarpeta>> | null = null;
  try {
    anterior = await llegeixCarpeta(carpeta);
  } catch (error) {
    // La primera vegada no hi ha res publicat, i el que no es pot llegir no es pot mantenir.
    if (!(error instanceof DesquadreError)) throw error;
  }

  const grups: Record<string, Grup> = {};
  const cossos = new Map<string, Uint8Array>();
  const fitxers: Record<string, unknown> = {};
  const fallades: Record<string, string> = {};
  for (const [nom, construeix] of Object.entries(fonts)) {
    const captures: Captura[] = [];
    const delGrup = new Map<string, Uint8Array>();
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
      delGrup.set(sha256, cos);
      return new Response(cos, { status: resposta.status, headers: resposta.headers });
    };
    let delaFont: Record<string, unknown>;
    try {
      delaFont = await construeix(enregistrat, data, pausaMs);
      grups[nom] = {
        data_consulta: data,
        node: process.version,
        fitxers: Object.fromEntries(
          Object.entries(delaFont).map(([fitxer, dades]) => [
            fitxer,
            empremta(new TextEncoder().encode(serialitza(dades))),
          ]),
        ),
        captures,
        fallada: null,
      };
      for (const [sha256, cos] of delGrup) cossos.set(sha256, cos);
    } catch (error) {
      if (!(error instanceof SourceError)) throw error;
      const publicat =
        anterior !== null && Object.hasOwn(anterior.procedencia.grups, nom)
          ? anterior.procedencia.grups[nom]!
          : null;
      if (publicat === null) throw error;
      let mantingut;
      try {
        mantingut = await verificaGrup(anterior!.llegeix, nom, publicat, construeix);
      } catch (desquadre) {
        if (!(desquadre instanceof DesquadreError)) throw desquadre;
        throw new SourceError(
          `${error.message} I el que se'n va publicar no es pot mantenir: ${desquadre.message}`,
        );
      }
      delaFont = mantingut.fitxers;
      grups[nom] = {
        ...publicat,
        // Es manté el primer dia que va fallar: diu des de quan les dades d'aquesta font no són d'avui.
        fallada: {
          data: publicat.fallada === null ? data : publicat.fallada.data,
          missatge: error.message,
        },
      };
      publicat.captures.forEach((captura, i) => cossos.set(captura.sha256, mantingut.cossos[i]!));
      fallades[nom] = error.message;
    }
    for (const [fitxer, dades] of Object.entries(delaFont)) {
      if (Object.hasOwn(fitxers, fitxer)) throw new Error(`Dues fonts generen ${fitxer}.`);
      fitxers[fitxer] = dades;
    }
  }
  if (Object.keys(fallades).length === Object.keys(fonts).length)
    throw new SourceError(`No ha respost cap font: ${Object.values(fallades).join(' ')}`);

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
  for (const [nom, dades] of Object.entries(fitxers))
    await writeFile(join(carpeta, nom), serialitza(dades));
  const procedencia: Procedencia = { grups };
  await writeFile(join(carpeta, 'procedencia.json'), serialitza(procedencia));
  return { fitxers: fitxers as Fitxers<F>, fallades };
}

/**
 * Comprova que les còpies de cada font tenen l'empremta que diu procedencia.json i que, tornant a
 * construir les dades a partir d'aquestes còpies, els JSON publicats surten idèntics, byte a byte.
 */
export async function verifica(carpeta: string, fonts: Fonts) {
  const { procedencia, llegeix } = await llegeixCarpeta(carpeta);
  if (!mateixesFonts(procedencia, fonts))
    throw new DesquadreError(
      `procedencia.json té les fonts ${Object.keys(procedencia.grups).join(', ')}, i el codi, ${Object.keys(fonts).join(', ')}.`,
    );
  const noms: string[] = [];
  for (const [nom, construeix] of Object.entries(fonts))
    noms.push(
      ...Object.keys(
        (await verificaGrup(llegeix, nom, procedencia.grups[nom]!, construeix)).fitxers,
      ),
    );
  return { procedencia, fitxers: noms };
}

/**
 * Genera a `desti` les dades que surten de les còpies publicades a `origen`, amb el codi d'ara. La CI
 * ho fa servir per construir la web amb les dades d'una pull request sense tornar a consultar les
 * fonts. Falla amb DesquadreError si el codi d'ara no demana les mateixes URL que les còpies.
 */
export async function reprodueix(origen: string, desti: string, fonts: Fonts) {
  const { procedencia, llegeix } = await llegeixCarpeta(origen);
  if (!mateixesFonts(procedencia, fonts))
    throw new DesquadreError(
      `Les còpies publicades són de les fonts ${Object.keys(procedencia.grups).join(', ')}, i el codi en té ${Object.keys(fonts).join(', ')}.`,
    );
  // Primer es construeix tot, sense escriure res: una reproducció que no quadra no ha de deixar
  // `desti` a mitges. No s'hi desa cap procedència: no és la de cap consulta a les fonts.
  const fitxers: Record<string, unknown> = {};
  for (const [nom, construeix] of Object.entries(fonts))
    Object.assign(
      fitxers,
      (
        await reprodueixGrup(llegeix, procedencia.grups[nom]!, (fetchImpl, data) =>
          construeix(fetchImpl, data, 0),
        )
      ).fitxers,
    );
  await mkdir(desti, { recursive: true });
  for (const [nom, dades] of Object.entries(fitxers))
    await writeFile(join(desti, nom), serialitza(dades));
}
