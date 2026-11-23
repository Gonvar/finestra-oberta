// L'històric del transport públic: cada mitja hora, una foto de com van els trens de Rodalies i
// d'FGC i dels avisos de TMB, feta a partir de les respostes dels operadors, que es desen tal com
// van arribar. De les fotos d'un dia en surt el resum del dia, que és el que mostra la web.
// Vegeu docs/transport.md.
import { createHash } from 'node:crypto';
import { SourceError, TEMPS_LIMIT_MS, type Fetch } from './comun.ts';
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
} from './transport.ts';

/** Les respostes que fan una foto. L'adreça de TMB es desa sense la clau. */
export const FONTS = {
  rodalies: `${RENFE_RT}/trip_updates.json`,
  fgc: `${FGC}/posicionament-dels-trens/exports/json?select=id%2Clin%2Cen_hora`,
  'fgc-metadades': `${FGC}/posicionament-dels-trens`,
  'tmb-metro': `${TMB}/alerts/metro/channels/WEB`,
  'tmb-bus': `${TMB}/alerts/bus/channels/WEB`,
} as const;
export type Font = keyof typeof FONTS;

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
      hourCycle: 'h23',
    })
      .formatToParts(consultat)
      .map((p) => [p.type, p.value]),
  );
  return {
    dia: `${parts.year}-${parts.month}-${parts.day}`,
    hora: `${parts.hour}:${parts.minute}`,
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
export function construeixFoto(respostes: Record<Font, string>, consultat: string) {
  const feed = json<RenfeFeed<TripUpdate>>(respostes.rodalies, 'rodalies');
  const rodalies: Record<string, { retards: Record<string, number | null>; cancellats: string[] }> =
    {};
  for (const e of feed.entity) {
    const id = e.tripUpdate.trip.tripId;
    if (nucli(id) !== NUCLI_RODALIES) continue;
    const l = (rodalies[liniaViatge(id).linia] ??= { retards: {}, cancellats: [] });
    if (e.tripUpdate.trip.scheduleRelationship === 'CANCELED') l.cancellats.push(id);
    else l.retards[id] = retardSegons(e.tripUpdate);
  }
  const fgc: Record<string, Record<string, boolean | null>> = {};
  for (const t of json<Tren[]>(respostes.fgc, 'fgc')) (fgc[t.lin] ??= {})[t.id] = enHora(t);
  const meta = json<{ metas: { default: { data_processed: string } } }>(
    respostes['fgc-metadades'],
    'fgc-metadades',
  );
  return {
    consultat,
    ...diaHora(new Date(consultat)),
    rodalies: {
      dades_de: new Date(Number(feed.header.timestamp) * 1000).toISOString(),
      linies: rodalies,
    },
    fgc: { dades_de: meta.metas.default.data_processed, linies: fgc },
    tmb: llegeixAvisosTmb(
      json<Estat<{ alerts: AlertaMetro[] }>>(respostes['tmb-metro'], 'tmb-metro'),
      json<Estat<{ alerts: AlertaBus[] }>>(respostes['tmb-bus'], 'tmb-bus'),
    ),
  };
}

export const empremta = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');

/** Una resposta sencera, tal com arriba. `params` són els que no es desen, com la clau de TMB. */
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
  } catch {
    throw new SourceError(`${url} no respon.`);
  }
  if (!resposta.ok) throw new SourceError(`${url} ha respost ${resposta.status}.`);
  return resposta.text();
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
  for (const [linia, l] of Object.entries(foto.rodalies.linies)) {
    const d = (dia.rodalies[linia] ??= { retards: {}, cancellats: [] });
    for (const [id, r] of Object.entries(l.retards)) d.retards[id] = maxim(d.retards[id], r);
    d.cancellats = [...new Set([...d.cancellats, ...l.cancellats])];
  }
  for (const [linia, trens] of Object.entries(foto.fgc.linies)) {
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
    rodalies: perLinia(d.rodalies, (l) => {
      const retards = Object.values(l.retards);
      return {
        trens: retards.length,
        amb_retard_de_5_min_o_mes: compta(retards, (r) => r !== null && r >= LLINDAR_RETARD_S),
        sense_retard_publicat: compta(retards, (r) => r === null),
        cancellats: l.cancellats.length,
      };
    }),
    fgc: perLinia(d.fgc, (trens) => {
      const h = Object.values(trens);
      return {
        trens: h.length,
        fora_d_hora: compta(h, (x) => x === false),
        sense_dada: compta(h, (x) => x === null),
      };
    }),
    tmb: { metro: xarxes('metro'), bus: xarxes('bus') },
  };
}

/** Com anava tot a l'última foto: el que la web mostra com a «ara». */
export function resumFoto(f: Foto) {
  return {
    consultat: f.consultat,
    rodalies: {
      dades_de: f.rodalies.dades_de,
      linies: perLinia(f.rodalies.linies, (l) => {
        const retards = Object.values(l.retards);
        return {
          trens: retards.length,
          amb_retard_de_5_min_o_mes: compta(retards, (r) => r !== null && r >= LLINDAR_RETARD_S),
          cancellats: l.cancellats.length,
        };
      }),
    },
    fgc: {
      dades_de: f.fgc.dades_de,
      linies: perLinia(f.fgc.linies, (trens) => {
        const h = Object.values(trens);
        return { trens: h.length, fora_d_hora: compta(h, (x) => x === false) };
      }),
    },
    tmb: f.tmb,
  };
}

export type Resum = {
  actualitzat: string;
  ara: ReturnType<typeof resumFoto>;
  dies: ReturnType<typeof resumDia>[];
};

/** El resum de tots els dies, amb el d'avui posat al dia. Els dies van del més recent al més antic. */
export function actualitzaResum(anterior: Resum | null, dia: Dia, foto: Foto): Resum {
  const dies = (anterior?.dies ?? []).filter((d) => d.dia !== dia.dia);
  dies.push(resumDia(dia));
  dies.sort((a, b) => b.dia.localeCompare(a.dia));
  return { actualitzat: foto.consultat, ara: resumFoto(foto), dies };
}
