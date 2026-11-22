// Uns quants indicadors de cada municipi, de l'Idescat (El municipi en xifres, API EMEX), per a la
// fitxa de cada municipi al mapa. No és un servidor MCP: src/dades.ts ho desa a la branca `dades`.
// Tots els municipis tenen els mateixos indicadors, de la mateixa taula i el mateix any.
import { getJson, SourceError, type Fetch } from './comun.ts';

const EMEX = 'https://api.idescat.cat/emex/v1';
export const FITXA_EMEX = 'https://www.idescat.cat/emex/';
// Sense municipi, l'API només dona cinc indicadors per crida.
const PER_CRIDA = 5;

/**
 * Els indicadors, per l'identificador de l'Idescat. Es publiquen els valors tal com els dona la
 * font, també el total de cada taula, perquè qui els mostri en pugui treure el percentatge.
 */
export const INDICADORS = [
  'f171', // Població, total
  'f184', // Població de nacionalitat estrangera
  'f263', // Població per nacionalitat, total
  'f73', // Població nascuda a l'estranger
  'f74', // Població per lloc de naixement, total
  'f92', // Població de 2 anys i més que sap parlar català (cens del 2011)
  'f96', // Població de 2 anys i més per coneixement del català, total
  'f242', // Atur registrat, mitjana anual
  'f10', // Base imposable general de l'IRPF per declarant
  'f385', // Índex socioeconòmic territorial
  'f149', // Participació a les eleccions municipals
  'f254', // Participació a les eleccions al Parlament
] as const;

type Col = { id: string; scheme: string; content: string };
type Indicador = {
  id: string;
  c: string;
  v: string;
  r: string;
  u?: string;
  t: { id: string; content: string };
  updated: string;
};

const llista = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x]);

function forma(dades: unknown): { cols: Col[]; indicadors: Indicador[] } {
  const fitxes = (dades as { fitxes?: { cols?: { col?: unknown }; indicadors?: { i?: unknown } } })
    .fitxes;
  if (fitxes?.cols?.col === undefined || fitxes.indicadors?.i === undefined)
    throw new SourceError(
      `L'API EMEX no té la forma esperada: ${JSON.stringify(dades).slice(0, 300)}.`,
    );
  return {
    cols: llista(fitxes.cols.col as Col | Col[]),
    indicadors: llista(fitxes.indicadors.i as Indicador | Indicador[]),
  };
}

/** Un valor de l'Idescat: «_» és una dada que no hi és, mai un zero. */
function valor(text: string, id: string) {
  const net = text.trim();
  if (net === '_') return null;
  if (!/^-?\d+(\.\d+)?$/.test(net)) throw new SourceError(`${id} té un valor inesperat: ${net}.`);
  return Number(net);
}

/**
 * Els indicadors de tots els municipis. `codis` són els municipis de Municat: les dues fonts han de
 * tenir els mateixos, o la fitxa d'algun municipi quedaria sense dades.
 */
export async function construirMunicipis(fetchImpl: Fetch, codis: Set<string>) {
  let municipis: Col[] | undefined;
  const indicadors: Indicador[] = [];
  for (let i = 0; i < INDICADORS.length; i += PER_CRIDA) {
    const params = new URLSearchParams({
      i: INDICADORS.slice(i, i + PER_CRIDA).join(','),
      tipus: 'mun',
      lang: 'ca',
    });
    const { cols, indicadors: tros } = forma(
      await getJson<unknown>(fetchImpl, `${EMEX}/dades.json?${params}`),
    );
    if (cols.some((c) => c.scheme !== 'mun' || !/^\d{6}$/.test(c.id)))
      throw new SourceError('L’API EMEX ha tornat territoris que no són municipis.');
    // Els valors van en l'ordre de les columnes: totes les crides han de tenir les mateixes.
    if (municipis && JSON.stringify(cols) !== JSON.stringify(municipis))
      throw new SourceError('Les crides a l’API EMEX no tornen els mateixos municipis.');
    municipis = cols;
    indicadors.push(...tros);
  }
  if (municipis === undefined) throw new SourceError('No hi ha cap indicador.');

  const rebuts = indicadors.map((x) => x.id);
  if (JSON.stringify(rebuts) !== JSON.stringify(INDICADORS))
    throw new SourceError(
      `L’API EMEX ha tornat ${rebuts.join(', ')}, no ${INDICADORS.join(', ')}.`,
    );
  const idescat = new Set(municipis.map((m) => m.id));
  const falten = [...codis].filter((c) => !idescat.has(c));
  const sobren = [...idescat].filter((c) => !codis.has(c));
  if (idescat.size !== municipis.length || falten.length > 0 || sobren.length > 0)
    throw new SourceError(
      `Els municipis de l’Idescat i els de Municat no coincideixen (falten ${falten.join(', ') || 'cap'}; sobren ${sobren.join(', ') || 'cap'}).`,
    );

  const valors = indicadors.map((x) => {
    const v = x.v.split(',');
    if (v.length !== municipis.length)
      throw new SourceError(`${x.id} té ${v.length} valors per a ${municipis.length} municipis.`);
    return v.map((text) => valor(text, x.id));
  });

  return {
    font: 'Idescat: El municipi en xifres (API EMEX)',
    url: FITXA_EMEX,
    nota: 'Cada indicador és de l’any que diu «any», el mateix per a tots els municipis. Un valor null és una dada que l’Idescat no dona per a aquell municipi, no un zero. Els totals de cada taula hi són perquè se’n pugui calcular el percentatge.',
    indicadors: indicadors.map((x) => ({
      id: x.id,
      nom: x.c,
      taula: x.t.content,
      any: x.r,
      unitat: x.u ?? null,
      actualitzat: x.updated.slice(0, 10),
    })),
    municipis: municipis
      .map((m, columna) => ({
        codi: m.id,
        nom: m.content,
        valors: Object.fromEntries(indicadors.map((x, fila) => [x.id, valors[fila]![columna]!])),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'ca')),
  };
}
