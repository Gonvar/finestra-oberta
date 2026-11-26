// L'històric del transport públic: cada mitja hora, una foto de com van els trens de Rodalies i
// d'FGC i dels avisos de TMB, feta a partir de les respostes dels operadors, que es desen tal com
// van arribar. De les fotos d'un dia en surt el resum del dia, que és el que mostra la web.
// Vegeu docs/transport.md.
import { createHash } from 'node:crypto';
import { esTall, FontNoRespon, SourceError, TEMPS_LIMIT_MS, type Fetch } from './comun.ts';
import {
  enHora,
  FGC,
  liniaViatge,
  llegeixAvisosTmb,
  NUCLI_RODALIES,
  nucli,
  RENFE_RT,
  retardSegons,
  TMB,
  type AlertaBus,
  type AlertaMetro,
  type Estat,
  type RenfeFeed,
  type Tren,
  type TripUpdate,
} from './operadors.ts';

/** Les respostes que fan una foto. L'adreça de TMB es desa sense la clau. */
export const FONTS = {
  rodalies: `${RENFE_RT}/trip_updates.json`,
  fgc: `${FGC}/posicionament-dels-trens/exports/json?select=id%2Clin%2Cen_hora`,
  'fgc-metadades': `${FGC}/posicionament-dels-trens`,
  'tmb-metro': `${TMB}/alerts/metro/channels/WEB`,
  'tmb-bus': `${TMB}/alerts/bus/channels/WEB`,
} as const;
export type Font = keyof typeof FONTS;

/**
 * Les fonts sense les quals encara es fa la foto. L'API d'FGC no respon cada nit durant unes hores,
 * i Rodalies i TMB no han de perdre aquestes fotos. La foto diu que FGC no ha respost i per què.
 */
export const FONTS_FGC = ['fgc', 'fgc-metadades'] as const satisfies Font[];

/** Una resposta desada: d'on surt, l'empremta dels bytes i el fitxer on és, comprimit. */
export type Captura = { font: Font; url: string; sha256: string; fitxer: string };

export type Foto = ReturnType<typeof construeixFoto> & { captures: Captura[] };

/** El dia i l'hora a Catalunya, que és com s'agrupen les fotos. */
export function diaHora(consultat: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(consultat)
      .map((p) => [p.type, p.value]),
  );
  return {
    dia: `${parts.year}-${parts.month}-${parts.day}`,
    hora: `${parts.hour}:${parts.minute}`,
    // Amb els segons, perquè dues execucions del mateix minut no es trepitgin els fitxers.
    instant: `${parts.hour}${parts.minute}${parts.second}`,
  };
}

const json = <T>(text: string, font: Font) => {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SourceError(`La resposta de ${font} no és JSON.`);
  }
};

/**
 * La foto que surt de les respostes. Només depèn dels bytes i de l'hora de la consulta, perquè
 * qualsevol persona la pugui tornar a fer amb les còpies i comprovar que surt igual.
 */
export function construeixFoto(
  respostes: Partial<Record<Font, string>>,
  consultat: string,
  fgcNoHaRespost: string | null,
) {
  const resposta = (font: Font) => {
    const r = respostes[font];
    if (r === undefined) throw new SourceError(`Falta la resposta de ${font}.`);
    return r;
  };
  const feed = json<RenfeFeed<TripUpdate>>(resposta('rodalies'), 'rodalies');
  const rodalies: Record<string, { retards: Record<string, number | null>; cancellats: string[] }> =
    {};
  for (const e of feed.entity) {
    const id = e.tripUpdate.trip.tripId;
    if (nucli(id) !== NUCLI_RODALIES) continue;
    const l = (rodalies[liniaViatge(id).linia] ??= { retards: {}, cancellats: [] });
    if (e.tripUpdate.trip.scheduleRelationship === 'CANCELED') l.cancellats.push(id);
    else l.retards[id] = retardSegons(e.tripUpdate);
  }
  let fgc:
    | { dades_de: string; linies: Record<string, Record<string, boolean | null>> }
    | {
        no_ha_respost: string;
      };
  if (fgcNoHaRespost !== null) {
    if (FONTS_FGC.some((f) => respostes[f] !== undefined))
      throw new SourceError('La foto diu que FGC no ha respost, però en té la resposta.');
    fgc = { no_ha_respost: fgcNoHaRespost };
  } else {
    const linies: Record<string, Record<string, boolean | null>> = {};
    for (const t of json<Tren[]>(resposta('fgc'), 'fgc')) (linies[t.lin] ??= {})[t.id] = enHora(t);
    const meta = json<{ metas: { default: { data_processed: string } } }>(
      resposta('fgc-metadades'),
      'fgc-metadades',
    );
    fgc = { dades_de: meta.metas.default.data_processed, linies };
  }
  return {
    consultat,
    ...diaHora(new Date(consultat)),
    rodalies: {
      dades_de: new Date(Number(feed.header.timestamp) * 1000).toISOString(),
      linies: rodalies,
    },
    fgc,
    tmb: llegeixAvisosTmb(
      json<Estat<{ alerts: AlertaMetro[] }>>(resposta('tmb-metro'), 'tmb-metro'),
      json<Estat<{ alerts: AlertaBus[] }>>(resposta('tmb-bus'), 'tmb-bus'),
    ),
  };
}

export const empremta = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/**
 * El text d'una resposta, a partir dels bytes que es desen. Un byte que no és UTF-8 és un error:
 * canviar-lo per un altre caràcter faria que la còpia digués una cosa que la font no va dir.
 */
export function decodifica(bytes: Uint8Array, font: Font) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new SourceError(`La resposta de ${font} no és UTF-8.`);
  }
}

/** Els bytes d'una resposta, tal com arriben. `params` són els que no es desen, com la clau de TMB. */
export async function baixa(fetchImpl: Fetch, url: string, params: Record<string, string> = {}) {
  const adreca = Object.keys(params).length
    ? `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`
    : url;
  let resposta: Response;
  try {
    resposta = await fetchImpl(adreca, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TEMPS_LIMIT_MS),
    });
  } catch (error) {
    if (!esTall(error)) throw error;
    throw new FontNoRespon(`${url} no respon.`);
  }
  if (resposta.status === 429 || resposta.status >= 500)
    throw new FontNoRespon(`${url} ha respost ${resposta.status}.`);
  if (!resposta.ok) throw new SourceError(`${url} ha respost ${resposta.status}.`);
  return new Uint8Array(await resposta.arrayBuffer());
}

// --- El dia ---

/**
 * Tot el que s'ha vist un dia, tren a tren, perquè cada tren es compti un sol cop encara que surti
 * a moltes fotos. De Rodalies es desa el retard més gran que se n'ha vist; d'FGC, si algun cop no
 * anava en hora; de TMB, cada avís amb la primera i l'última foto on surt.
 */
export type Dia = {
  dia: string;
  fotos: string[];
  rodalies: Record<string, { retards: Record<string, number | null>; cancellats: string[] }>;
  fgc: Record<string, Record<string, boolean | null>>;
  tmb: Record<
    string,
    { xarxa: 'metro' | 'bus'; linies: string[]; text: string; primer: string; darrer: string }
  >;
};

const maxim = (a: number | null | undefined, b: number | null) =>
  a === undefined || a === null ? b : b === null ? a : Math.max(a, b);

// Un tren que algun cop no anava en hora no hi va; si mai no se'n sap res, no se'n sap res.
const pitjor = (a: boolean | null | undefined, b: boolean | null) =>
  a === false || b === false ? false : a === true || b === true ? true : null;

export function afegeixFoto(anterior: Dia | null, foto: Foto): Dia {
  if (anterior && anterior.dia !== foto.dia)
    throw new SourceError(`El resum del ${anterior.dia} no és el del dia de la foto, ${foto.dia}.`);
  const dia: Dia = structuredClone(
    anterior ?? { dia: foto.dia, fotos: [], rodalies: {}, fgc: {}, tmb: {} },
  );
  if (dia.fotos.includes(foto.consultat)) return dia;
  dia.fotos.push(foto.consultat);
  // Un tren que en alguna foto surt cancel·lat compta com a cancel·lat, i no també com a circulant.
  for (const [linia, l] of Object.entries(foto.rodalies.linies)) {
    const d = (dia.rodalies[linia] ??= { retards: {}, cancellats: [] });
    d.cancellats = [...new Set([...d.cancellats, ...l.cancellats])];
    for (const [id, r] of Object.entries(l.retards))
      if (!d.cancellats.includes(id)) d.retards[id] = maxim(d.retards[id], r);
    for (const id of d.cancellats) delete d.retards[id];
  }
  // Una foto en què FGC no ha respost no afegeix cap tren d'FGC al dia.
  const linies = 'linies' in foto.fgc ? foto.fgc.linies : {};
  for (const [linia, trens] of Object.entries(linies)) {
    const d = (dia.fgc[linia] ??= {});
    for (const [id, h] of Object.entries(trens)) d[id] = pitjor(d[id], h);
  }
  const avisos = [
    ...foto.tmb.metro.map((a) => ({
      clau: `metro-${a.id}`,
      xarxa: 'metro' as const,
      linies: a.linies,
      text: a.textos.join(' '),
    })),
    ...foto.tmb.bus.map((a) => ({
      clau: `bus-${a.id}`,
      xarxa: 'bus' as const,
      linies: a.linies,
      text: a.text,
    })),
  ];
  for (const { clau, ...a } of avisos) {
    const d = dia.tmb[clau];
    dia.tmb[clau] = { ...a, primer: d?.primer ?? foto.consultat, darrer: foto.consultat };
  }
  return dia;
}

// --- El resum que llegeix la web ---

/** El llindar és una tria del projecte, no de Renfe: per això va al nom de cada camp. */
export const LLINDAR_RETARD_S = 5 * 60;

const perLinia = <T, R>(linies: Record<string, T>, f: (l: T) => R) =>
  Object.fromEntries(
    Object.keys(linies)
      .sort((a, b) => a.localeCompare(b, 'ca', { numeric: true }))
      .map((k) => [k, f(linies[k] as T)]),
  );

const compta = <T>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;

/**
 * Els trens d'una línia de Rodalies. `trens` només compta els que tenen el retard publicat: un tren
 * sense dada no pot sumar a la part amb retard, i si comptés al total faria semblar la línia més
 * puntual. Els que no en tenen es donen a part.
 */
function liniaRodalies(l: { retards: Record<string, number | null>; cancellats: string[] }) {
  const retards = Object.values(l.retards);
  const coneguts = retards.filter((r) => r !== null);
  return {
    trens: coneguts.length,
    amb_retard_de_5_min_o_mes: compta(coneguts, (r) => r >= LLINDAR_RETARD_S),
    sense_retard_publicat: retards.length - coneguts.length,
    cancellats: l.cancellats.length,
  };
}

/** El mateix per a FGC: `trens` només compta els que FGC diu si van en hora o no. */
function liniaFgc(trens: Record<string, boolean | null>) {
  const h = Object.values(trens);
  const coneguts = h.filter((x) => x !== null);
  return {
    trens: coneguts.length,
    fora_d_hora: compta(coneguts, (x) => x === false),
    sense_dada: h.length - coneguts.length,
  };
}

/** Quants trens s'han vist un dia per línia, i quants han anat amb retard, comptats un sol cop. */
export function resumDia(d: Dia) {
  const xarxes = (xarxa: 'metro' | 'bus') => {
    const perL: Record<string, number> = {};
    for (const a of Object.values(d.tmb))
      if (a.xarxa === xarxa) for (const l of a.linies) perL[l] = (perL[l] ?? 0) + 1;
    return perLinia(perL, (n) => n);
  };
  return {
    dia: d.dia,
    fotos: d.fotos.length,
    primera: d.fotos[0],
    darrera: d.fotos.at(-1),
    rodalies: perLinia(d.rodalies, liniaRodalies),
    fgc: perLinia(d.fgc, liniaFgc),
    tmb: { metro: xarxes('metro'), bus: xarxes('bus') },
  };
}

/** Com anava tot a l'última foto: el que la web mostra com a «ara». */
export function resumFoto(f: Foto) {
  return {
    consultat: f.consultat,
    rodalies: { dades_de: f.rodalies.dades_de, linies: perLinia(f.rodalies.linies, liniaRodalies) },
    fgc:
      'linies' in f.fgc
        ? { dades_de: f.fgc.dades_de, linies: perLinia(f.fgc.linies, liniaFgc) }
        : f.fgc,
    tmb: f.tmb,
  };
}

export type Resum = {
  actualitzat: string;
  ara: ReturnType<typeof resumFoto>;
  dies: ReturnType<typeof resumDia>[];
};

/** La web en mostra com a molt 30 dies; els anteriors són a dies/, que es guarda per sempre. */
export const DIES_RESUM = 30;

/** El resum dels últims dies, amb el d'avui posat al dia. Van del més recent al més antic. */
export function actualitzaResum(anterior: Resum | null, dia: Dia, foto: Foto): Resum {
  const dies = (anterior?.dies ?? []).filter((d) => d.dia !== dia.dia);
  dies.push(resumDia(dia));
  dies.sort((a, b) => b.dia.localeCompare(a.dia));
  return { actualitzat: foto.consultat, ara: resumFoto(foto), dies: dies.slice(0, DIES_RESUM) };
}
