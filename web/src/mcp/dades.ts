// Les dades publicades a la branca `dades`, tal com la web les serveix a /dades/. El servidor MCP en
// llegeix una part (un camí, una pàgina d'una llista) sense canviar cap valor ni l'ordre de la font.
import { matches, SourceError, words } from '../../../src/comun.ts';

export type Valor = null | boolean | number | string | Valor[] | { [camp: string]: Valor };
type Objecte = { [camp: string]: Valor };

/** El text d'un fitxer de la web, com «dades/govern.json» o «conjunts.json». */
export type Llegeix = (cami: string) => Promise<string>;

export const WEB = 'https://finestraoberta.cat';
const COM_VERIFICAR =
  'https://github.com/Gonvar/finestra-oberta/blob/main/docs/institucions.md#com-comprovar-que-les-dades-s%C3%B3n-de-la-font';

export type Procedencia = { data_consulta: string; fitxers: Record<string, string> };

const esObjecte = (valor: Valor): valor is Objecte =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

// Cada fitxer diu d'on surt amb aquests camps, al primer nivell o dins d'un bloc com `govern` a
// agenda.json. Llegir-los pel nom fa que un conjunt nou en tingui sense tocar aquest codi.
const CAMP_FONT = /^(font|url|data|nota|llicencia|condicions|fotos)/;

/** La font, la data i les notes d'un fitxer, tal com les escriu el fitxer. */
export function fonts(dades: Valor): Objecte {
  if (!esObjecte(dades)) throw new SourceError('El fitxer publicat no és un objecte.');
  const resultat: Objecte = {};
  for (const [camp, valor] of Object.entries(dades)) {
    if (esObjecte(valor)) {
      const dins = Object.fromEntries(
        Object.entries(valor).filter(
          ([c, v]) => CAMP_FONT.test(c) && (v === null || typeof v !== 'object'),
        ),
      );
      if (Object.keys(dins).length > 0) resultat[camp] = dins;
    } else if (CAMP_FONT.test(camp) && !Array.isArray(valor)) resultat[camp] = valor;
  }
  if (Object.keys(resultat).length === 0)
    throw new SourceError('El fitxer publicat no diu de quina font surt.');
  return resultat;
}

const MAX_LLISTA = 40;

/** Els noms d'una llista per a un missatge, sense passar del límit d'una resposta. */
const llista = (noms: string[]) =>
  noms.length > MAX_LLISTA
    ? `${noms.slice(0, MAX_LLISTA).join(', ')} i ${noms.length - MAX_LLISTA} més`
    : noms.join(', ');

/** El valor d'un camí com «consellers.3.nom». Un camí buit és tot el fitxer. */
export function segueix(dades: Valor, cami: string, fet: string[] = []): Valor {
  if (cami === '') return dades;
  let valor = dades;
  fet = [...fet];
  for (const tros of cami.split('.')) {
    if (Array.isArray(valor)) {
      const index = /^\d+$/.test(tros) ? Number(tros) : NaN;
      if (valor.length === 0)
        throw new SourceError(`${fet.join('.') || 'El fitxer'} és una llista buida.`);
      if (!(index < valor.length))
        throw new SourceError(
          `${fet.join('.') || 'El fitxer'} és una llista de ${valor.length} elements: «${tros}» no hi és. Fes servir un número de 0 a ${valor.length - 1}.`,
        );
      valor = valor[index] as Valor;
    } else if (esObjecte(valor)) {
      if (!Object.hasOwn(valor, tros))
        throw new SourceError(
          `«${tros}» no és un camp ${fet.length ? `de ${fet.join('.')}` : 'del fitxer'}. Els camps són: ${llista(Object.keys(valor))}.`,
        );
      valor = valor[tros] as Valor;
    } else throw new SourceError(`${fet.join('.')} és un valor, i no té camps.`);
    fet.push(tros);
  }
  return valor;
}

const MAX_TEXT = 120;

function tipus(valor: Valor): string {
  if (valor === null) return 'null';
  if (Array.isArray(valor)) return 'llista';
  if (typeof valor === 'object') return 'objecte';
  if (typeof valor === 'string') return 'text';
  return typeof valor === 'number' ? 'nombre' : 'sí o no';
}

/** Com és un valor, sense tornar-lo sencer: per saber quin camí demanar. */
function resum(valor: Valor): Valor {
  if (Array.isArray(valor)) return `llista de ${valor.length}`;
  if (esObjecte(valor)) return `objecte amb ${Object.keys(valor).length} camps`;
  if (typeof valor === 'string' && valor.length > MAX_TEXT)
    return `text de ${valor.length} caràcters`;
  return valor;
}

export function estructura(valor: Valor): Valor {
  if (Array.isArray(valor)) {
    // Els camps de tots els elements, no només del primer: un camp pot faltar o ser null en alguns.
    const camps = new Map<string, Set<string>>();
    for (const element of valor)
      if (esObjecte(element))
        for (const [camp, v] of Object.entries(element)) {
          if (!camps.has(camp)) camps.set(camp, new Set());
          camps.get(camp)!.add(tipus(v));
        }
    return {
      tipus: 'llista',
      elements: valor.length,
      tipus_elements: [...new Set(valor.map(tipus))].join(' o '),
      camps_dels_elements: Object.fromEntries(
        [...camps].map(([camp, t]) => [camp, [...t].join(' o ')]),
      ),
    };
  }
  if (esObjecte(valor))
    return {
      tipus: 'objecte',
      camps: Object.fromEntries(Object.entries(valor).map(([camp, v]) => [camp, resum(v)])),
    };
  return { tipus: tipus(valor), valor };
}

/** Tot el text i els nombres d'un element, per cercar-hi paraules. */
function textDe(valor: Valor): string {
  if (Array.isArray(valor)) return valor.map(textDe).join(' ');
  if (esObjecte(valor)) return Object.values(valor).map(textDe).join(' ');
  return valor === null ? '' : String(valor);
}

/** On es cerca dins d'un element: tot l'element, o només un camp seu. */
function on(element: Valor, camp: string | undefined): Valor {
  if (camp === undefined) return element;
  // Un element sense el camp no hi coincideix: a la font, un camp pot faltar en alguns elements.
  return esObjecte(element) && Object.hasOwn(element, camp) ? (element[camp] as Valor) : null;
}

export const MAX_ELEMENTS = 100;
// Una resposta més llarga ja no hi cap, en el context d'un assistent, amb la resta de la conversa.
export const MAX_CARACTERS = 60_000;

type Consulta = { cami: string; cerca?: string; camp?: string; desde: number; quants: number };

/** La pàgina d'una llista: els índexs de la font que hi entren, i el que diu la resposta. */
function pagina(
  elements: number,
  trobats: number[],
  { cerca, camp, desde, quants }: Omit<Consulta, 'cami'>,
) {
  return {
    capcalera: {
      elements,
      ...(cerca === undefined
        ? {}
        : { cerca, ...(camp === undefined ? {} : { camp }), coincidencies: trobats.length }),
      desde,
      ...(desde + quants < trobats.length ? { seguent: desde + quants } : {}),
    },
    indexs: trobats.slice(desde, desde + quants),
  };
}

function consultaValor(valor: Valor, { cami, cerca, camp, desde, quants }: Consulta): Objecte {
  if (camp !== undefined && cerca === undefined)
    throw new SourceError('«camp» diu on cercar: cal també «cerca».');
  if (!Array.isArray(valor)) {
    if (cerca !== undefined)
      throw new SourceError(`${cami || 'El fitxer'} no és una llista: la cerca no s'hi aplica.`);
    return { resultat: valor };
  }
  const paraules = words(cerca);
  if (camp !== undefined && !valor.some((e) => esObjecte(e) && Object.hasOwn(e, camp)))
    throw new SourceError(
      `Cap element ${cami ? `de ${cami}` : 'del fitxer'} no té el camp «${camp}». Mira'n els camps amb veure_estructura.`,
    );
  // L'índex de cada element és el de la font, perquè se'n pugui demanar el camí.
  const trobats = valor.flatMap((element, index) =>
    matches(textDe(on(element, camp)), paraules) ? [index] : [],
  );
  const { capcalera, indexs } = pagina(valor.length, trobats, { cerca, camp, desde, quants });
  return { ...capcalera, resultat: indexs.map((index) => ({ index, valor: valor[index]! })) };
}

export const consulta = (dades: Valor, parametres: Consulta) =>
  consultaValor(segueix(dades, parametres.cami), parametres);

const mida = (resposta: unknown) => JSON.stringify(resposta, null, 2).length;

const massaGran = (caracters: string) =>
  new SourceError(
    `La resposta té ${caracters} caràcters i el màxim és ${MAX_CARACTERS}. Demana un camí més concret (mira'l amb veure_estructura) o menys elements amb «quants».`,
  );

/** Atura una resposta que no hi cabria, mesurada tal com l'envia `run`. */
function limita<T>(resposta: T): T {
  const caracters = mida(resposta);
  if (caracters > MAX_CARACTERS) throw massaGran(String(caracters));
  return resposta;
}

/** D'on surt un conjunt i com verificar-lo: el que acompanya cada resposta. */
export function context(nom: string, sha256: string, dades: Valor) {
  return {
    conjunt: nom,
    fonts: fonts(dades),
    verificacio: {
      fitxer: `${WEB}/dades/${nom}.json`,
      sha256,
      procedencia: `${WEB}/dades/procedencia.json`,
      com_verificar: COM_VERIFICAR,
    },
  };
}

/**
 * La llista de conjunts, que la web genera en compilar-se a /conjunts.json. Així llistar_conjunts no
 * ha d'analitzar tots els fitxers, que són molts megabytes, a cada Worker nou.
 */
export function cataleg(procedencia: Procedencia, llegeix: (fitxer: string) => Valor) {
  return {
    data_consulta: procedencia.data_consulta,
    conjunts: Object.entries(procedencia.fitxers).map(([fitxer, sha256]) =>
      context(fitxer.replace(/\.json$/, ''), sha256, llegeix(fitxer)),
    ),
  };
}

// El pla gratuït de Workers dona 10 ms de CPU per petició, i analitzar un fitxer de dades sencer ja
// en passa (mapa-municipis.json en fa 13 MB). Per això el build els parteix en trossos: cada camp del
// primer nivell en un fitxer, i les llistes grans en pàgines, amb un índex per cercar en cada camp.
// Una consulta només llegeix els trossos que necessita. Els valors i l'ordre són els del fitxer.
const LLISTA_GRAN = 200_000;
const MIDA_PAGINA = 100_000;

type Llista = {
  elements: number;
  /** El primer índex de cada pàgina. */
  pagines: number[];
  /** La mida de cada element tal com surt a la resposta, per aturar-la abans de llegir-lo. */
  mides: number[];
  /** Els camps amb un índex de cerca: els que tenen text o nombres, no objectes ni llistes. */
  camps: string[];
  estructura: Valor;
};

type Arrel = ReturnType<typeof context> & {
  /** El dia en què el workflow va llegir les fonts, per als conjunts que no diuen la data a «fonts». */
  data_consulta: string;
  estructura: Valor;
  /** Cada camp del primer nivell: una llista partida en pàgines, o null si és en un sol tros. */
  claus: Record<string, Llista | null>;
};

const CLAU = /^[a-z0-9_-]+$/i;

/** Els trossos d'un conjunt, pel camí que tenen a /conjunts/. */
export function trossos(nom: string, sha256: string, dades: Valor, procedencia: Procedencia) {
  if (!esObjecte(dades)) throw new SourceError(`${nom}.json no és un objecte.`);
  const fitxers: Record<string, Valor> = {};
  const claus: Arrel['claus'] = {};
  for (const [clau, valor] of Object.entries(dades)) {
    if (!CLAU.test(clau))
      throw new Error(`${nom}.json té un camp que no es pot fer camí: «${clau}».`);
    if (!Array.isArray(valor) || JSON.stringify(valor).length <= LLISTA_GRAN) {
      fitxers[`${nom}/${clau}.json`] = valor;
      claus[clau] = null;
      continue;
    }
    const pagines: number[] = [];
    let acumulat = Infinity;
    valor.forEach((element, index) => {
      const compacte = JSON.stringify(element).length;
      if (acumulat + compacte > MIDA_PAGINA) {
        pagines.push(index);
        acumulat = 0;
      }
      acumulat += compacte;
    });
    pagines.forEach((inici, p) => {
      fitxers[`${nom}/${clau}/${p}.json`] = valor.slice(inici, pagines[p + 1]);
    });
    const camps = [
      ...new Set(valor.flatMap((element) => (esObjecte(element) ? Object.keys(element) : []))),
    ].filter(
      (camp) =>
        CLAU.test(camp) &&
        valor.every((element) => {
          const v = on(element, camp);
          return v === null || typeof v !== 'object';
        }),
    );
    for (const camp of camps)
      fitxers[`${nom}/${clau}/cerca/${camp}.json`] = valor.map((e) => textDe(on(e, camp)));
    claus[clau] = {
      elements: valor.length,
      pagines,
      mides: valor.map(mida),
      camps,
      estructura: estructura(valor),
    };
  }
  const arrel: Arrel = {
    ...context(nom, sha256, dades),
    data_consulta: procedencia.data_consulta,
    estructura: estructura(dades),
    claus,
  };
  fitxers[`${nom}.json`] = arrel as unknown as Valor;
  return fitxers;
}

/**
 * Llegeix els trossos publicats a /conjunts/ un sol cop. Els fitxers d'una versió de la web no
 * canvien: quan es publiquen dades noves, Cloudflare en compila una altra amb un altre Worker.
 */
export function creaDades(llegeix: Llegeix) {
  const llegits = new Map<string, Promise<Valor>>();
  const json = (fitxer: string) => {
    let promesa = llegits.get(fitxer);
    if (!promesa) {
      promesa = llegeix(fitxer).then((text) => JSON.parse(text) as Valor);
      llegits.set(fitxer, promesa);
      // Un error de lectura no es desa: la crida següent ho torna a provar.
      promesa.catch(() => llegits.delete(fitxer));
    }
    return promesa;
  };
  const cat = () => json('conjunts.json') as Promise<ReturnType<typeof cataleg>>;

  async function arrel(nom: string) {
    const { conjunts } = await cat();
    if (!conjunts.some((c) => c.conjunt === nom))
      throw new SourceError(
        `No hi ha cap conjunt «${nom}». Els conjunts són: ${conjunts.map((c) => c.conjunt).join(', ')}.`,
      );
    const { estructura, claus, ...context } = (await json(`conjunts/${nom}.json`)) as Arrel;
    return { estructura, claus, context };
  }

  /** Els elements d'una llista partida, per índex, llegint només les pàgines on són. */
  async function elements(nom: string, clau: string, llista: Llista, indexs: number[]) {
    const pagines = new Map<number, Promise<Valor>>();
    return Promise.all(
      indexs.map(async (index) => {
        let p = 0;
        while (p + 1 < llista.pagines.length && llista.pagines[p + 1]! <= index) p++;
        if (!pagines.has(p)) pagines.set(p, json(`conjunts/${nom}/${clau}/${p}.json`));
        const pagina = (await pagines.get(p)) as Valor[];
        return pagina[index - llista.pagines[p]!]!;
      }),
    );
  }

  /** El valor d'un camí, sense llegir el que no hi és. */
  async function valor(nom: string, claus: Arrel['claus'], cami: string) {
    const [clau, ...resta] = cami.split('.');
    if (!Object.hasOwn(claus, clau!))
      throw new SourceError(
        `«${clau}» no és un camp del fitxer. Els camps són: ${llista(Object.keys(claus))}.`,
      );
    const partida = claus[clau!]!;
    if (partida === null)
      return segueix(await json(`conjunts/${nom}/${clau}.json`), resta.join('.'), [clau!]);
    if (resta.length === 0) throw new Error('Una llista partida es llegeix per pàgines.');
    const [tros, ...dins] = resta;
    const index = /^\d+$/.test(tros!) ? Number(tros) : NaN;
    if (!(index < partida.elements))
      throw new SourceError(
        `${clau} és una llista de ${partida.elements} elements: «${tros}» no hi és. Fes servir un número de 0 a ${partida.elements - 1}.`,
      );
    const [element] = await elements(nom, clau!, partida, [index]);
    return segueix(element!, dins.join('.'), [clau!, tros!]);
  }

  /** Tot el conjunt, si no té cap llista partida: si en té, no hi cabria. */
  async function sencer(nom: string, claus: Arrel['claus']) {
    const partides = Object.values(claus).filter((c) => c !== null);
    if (partides.length > 0)
      throw massaGran(
        `més de ${partides.reduce((suma, c) => suma + c.mides.reduce((a, b) => a + b, 0), 0)}`,
      );
    return Object.fromEntries(
      await Promise.all(
        Object.keys(claus).map(async (clau) => [clau, await valor(nom, claus, clau)] as const),
      ),
    );
  }

  async function consultaPartida(
    nom: string,
    clau: string,
    partida: Llista,
    { cerca, camp, desde, quants }: Consulta,
  ) {
    if (camp !== undefined && cerca === undefined)
      throw new SourceError('«camp» diu on cercar: cal també «cerca».');
    let trobats = Array.from({ length: partida.elements }, (_, index) => index);
    if (cerca !== undefined) {
      if (camp === undefined || !partida.camps.includes(camp))
        throw new SourceError(
          `${clau} té ${partida.elements} elements: per cercar-hi, digues en quin camp amb «camp». Es pot cercar en: ${llista(partida.camps)}.`,
        );
      const textos = (await json(`conjunts/${nom}/${clau}/cerca/${camp}.json`)) as string[];
      const paraules = words(cerca);
      trobats = trobats.filter((index) => matches(textos[index]!, paraules));
    }
    const { capcalera, indexs } = pagina(partida.elements, trobats, { cerca, camp, desde, quants });
    const minim = indexs.reduce((suma, index) => suma + partida.mides[index]!, 0);
    if (minim > MAX_CARACTERS) throw massaGran(`més de ${minim}`);
    const valors = await elements(nom, clau, partida, indexs);
    return {
      ...capcalera,
      resultat: indexs.map((index, i) => ({ index, valor: valors[i]! })),
    };
  }

  return {
    llistar: cat,
    async estructura(nom: string, cami: string) {
      const { estructura: deLArrel, claus, context } = await arrel(nom);
      const partida = Object.hasOwn(claus, cami) ? claus[cami] : null;
      const resultat =
        cami === ''
          ? deLArrel
          : partida
            ? partida.estructura
            : estructura(await valor(nom, claus, cami));
      return limita({ ...context, cami, estructura: resultat });
    },
    async consulta(nom: string, parametres: Consulta) {
      const { claus, context } = await arrel(nom);
      const { cami } = parametres;
      const partida = Object.hasOwn(claus, cami) ? claus[cami] : null;
      const resposta = partida
        ? await consultaPartida(nom, cami, partida, parametres)
        : cami === ''
          ? consultaValor(await sencer(nom, claus), parametres)
          : consultaValor(await valor(nom, claus, cami), parametres);
      return limita({ ...context, cami, ...resposta });
    },
  };
}

export type Dades = ReturnType<typeof creaDades>;
