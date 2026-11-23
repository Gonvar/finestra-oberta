// Servidor MCP del transport públic: Rodalies de Catalunya, amb les dades obertes de Renfe
// (el GTFS Realtime en JSON i el portal CKAN data.renfe.com); Ferrocarrils de la Generalitat de
// Catalunya, amb el seu portal Opendatasoft; i TMB, amb la seva API, que demana una clau gratuïta.
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  getJson,
  matches,
  text,
  READ_ONLY_EXTERNAL,
  run,
  SourceError,
  words,
  type Fetch,
} from './comun.ts';

export const FGC = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets';
export const RENFE_RT = 'https://gtfsrt.renfe.com';
const RENFE_CKAN = 'https://data.renfe.com/api/3/action';
export const TMB = 'https://api.tmb.cat/v1';

const SOURCE =
  "Font: Renfe, dades obertes (data.renfe.com i gtfsrt.renfe.com); Ferrocarrils de la Generalitat de Catalunya (dadesobertes.fgc.cat), amb llicència CC BY 4.0; i Transports Metropolitans de Barcelona (developer.tmb.cat). Cita l'operador i la data de les dades.";

const INSTRUCTIONS = `El transport públic de Catalunya que publiquen els operadors: Rodalies de Catalunya (Renfe), Ferrocarrils de la Generalitat (FGC) i el metro i els autobusos de TMB.
- retards dona els trens de Rodalies i d'FGC que circulen ara mateix per línia i com van d'hora (TMB no en publica); avisos, les incidències vigents; horaris_fgc, els propers trens d'una estació d'FGC; propers_tmb, els propers metros d'una estació o busos d'una parada; estacions, linies_fgc i demanda, la xarxa i els viatgers.
- Les dades en temps real són d'un moment: dona sempre l'hora de «dades_de». No són un històric: el retard d'ara no diu com ha anat el dia ni el mes.
- Rodalies i FGC no fan servir el mateix criteri. De Rodalies es dona el retard en minuts que publica Renfe; d'FGC, si l'operador diu que el tren va «en hora» o no, sense minuts. No els comparis com si fossin la mateixa mesura.
- Els avisos de Renfe són en castellà, i alguns també en català: dona'ls tal com són, citant l'operador.
- Les dades de demanda són d'anys concrets (Rodalies, 2018; FGC, del 2019 al 2024): digues-ne sempre l'any.
${SOURCE}`;

const OPERADOR = z.enum(['rodalies', 'fgc']).describe('rodalies (Renfe) o fgc.');
const OPERADOR_TMB = z.enum(['rodalies', 'fgc', 'tmb']).describe('rodalies (Renfe), fgc o tmb.');

const isoDeSegons = (segons: string) => new Date(Number(segons) * 1000).toISOString();

/** El dia a Catalunya, «AAAA-MM-DD». */
const diaLocal = (ara: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(ara);

/** L'hora local de Catalunya, «HH:MM», com les dels horaris d'FGC. */
function horaLocal(ara: Date) {
  return new Intl.DateTimeFormat('ca', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ara);
}

function agrupa<T>(xs: T[], clau: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(clau(x), [...(m.get(clau(x)) ?? []), x]);
  return m;
}

// --- Renfe ---

export type RenfeFeed<E> = { header: { timestamp: string }; entity: E[] };
export type TripUpdate = {
  id: string;
  tripUpdate: {
    trip: { tripId: string; scheduleRelationship?: string };
    delay?: number;
    stopTimeUpdate?: { arrival?: { delay?: number } }[];
  };
};
type Traduccio = { text: string; language: string };
type Alert = {
  id: string;
  alert: {
    activePeriod?: { start?: string; end?: string }[];
    informedEntity?: { routeId?: string; stopId?: string }[];
    headerText?: { translation: Traduccio[] };
    descriptionText?: { translation: Traduccio[] };
  };
};

/**
 * El feed de Renfe és de tot l'Estat. Els dos primers dígits dels viatges i de les rutes són el
 * nucli de rodalies, i el 51 és el de Barcelona, és a dir, Rodalies de Catalunya: «5126L28416R2N»,
 * «SPECIAL_51_91025R2», «51T0025R2». Després hi ha el número del tren i, al final, la línia: R2N, R2.
 */
export const NUCLI_RODALIES = '51';
const VIATGE = /^(?:SPECIAL_(\d{2})_|(\d{2})\d{2}L)\d+([A-Z][A-Za-z0-9]*)$/;
const RUTA = /^(\d{2})T\d+([A-Z][A-Za-z0-9]*)$/;

/** El nucli, que es mira primer: un identificador estrany d'un altre nucli no afecta Rodalies. */
export const nucli = (id: string) => /^(?:SPECIAL_)?(\d{2})/.exec(id)?.[1];

export function liniaViatge(tripId: string) {
  const m = VIATGE.exec(tripId);
  if (!m)
    throw new SourceError(`Renfe ha publicat un viatge amb un identificador inesperat: ${tripId}.`);
  return { nucli: (m[1] ?? m[2]) as string, linia: m[3] as string };
}

/** El retard que dona Renfe: el del viatge o, si no en té, el de la primera parada. */
export function retardSegons(u: TripUpdate['tripUpdate']) {
  if (u.delay !== undefined) return u.delay;
  const parada = u.stopTimeUpdate?.[0]?.arrival?.delay;
  return parada ?? null;
}

// El llindar és una tria del servidor, no de Renfe: per això va al nom del camp i el retard
// mitjà i el màxim es donen igualment.
const LLINDAR_RETARD_S = 5 * 60;

export async function retardsRodalies(fetchImpl: Fetch) {
  const feed = await getJson<RenfeFeed<TripUpdate>>(fetchImpl, `${RENFE_RT}/trip_updates.json`);
  const perLinia = new Map<
    string,
    { trens: number; cancellats: number; sense_retard_publicat: number; retards: number[] }
  >();
  for (const e of feed.entity) {
    if (nucli(e.tripUpdate.trip.tripId) !== NUCLI_RODALIES) continue;
    const { linia } = liniaViatge(e.tripUpdate.trip.tripId);
    const l = perLinia.get(linia) ?? {
      trens: 0,
      cancellats: 0,
      sense_retard_publicat: 0,
      retards: [],
    };
    perLinia.set(linia, l);
    if (e.tripUpdate.trip.scheduleRelationship === 'CANCELED') {
      l.cancellats++;
      continue;
    }
    l.trens++;
    const retard = retardSegons(e.tripUpdate);
    if (retard === null) l.sense_retard_publicat++;
    else l.retards.push(retard);
  }
  const linies = [...perLinia]
    .sort(([a], [b]) => a.localeCompare(b, 'ca', { numeric: true }))
    .map(([linia, l]) => ({
      linia,
      trens_circulant: l.trens,
      trens_cancellats: l.cancellats,
      amb_retard_de_5_min_o_mes: l.retards.filter((r) => r >= LLINDAR_RETARD_S).length,
      retard_mitja_min:
        l.retards.length === 0
          ? null
          : Math.round(l.retards.reduce((a, b) => a + b, 0) / l.retards.length / 6) / 10,
      retard_maxim_min: l.retards.length === 0 ? null : Math.round(Math.max(...l.retards) / 6) / 10,
      ...(l.sense_retard_publicat > 0 && { sense_retard_publicat: l.sense_retard_publicat }),
    }));
  return {
    operador: 'Rodalies de Catalunya (Renfe)',
    dades_de: isoDeSegons(feed.header.timestamp),
    criteri:
      'Retard en minuts que publica Renfe per a cada tren en circulació (negatiu si va avançat). La mitjana inclou tots els trens amb retard publicat. Els cancel·lats no compten com a circulant.',
    linies,
  };
}

type Estacio = { codi: string; nom: string; poblacio: string; latitud: number; longitud: number };
const ESTACIONS_RODALIES = 'e3969f12-aff2-468e-9b82-a65a6dd1a0d3';

async function datastore<T>(fetchImpl: Fetch, params: Record<string, string>) {
  const r = await getJson<{ success: boolean; result: { total: number; records: T[] } }>(
    fetchImpl,
    `${RENFE_CKAN}/datastore_search?${new URLSearchParams(params)}`,
  );
  if (!r.success) throw new SourceError('data.renfe.com no ha pogut fer la consulta.');
  return r.result;
}

type FilaEstacio = {
  CÓDIGO: number;
  DESCRIPCION: string;
  POBLACION: string;
  LATITUD: number;
  LONGITUD: number;
};

async function estacionsRodalies(fetchImpl: Fetch): Promise<Estacio[]> {
  const r = await datastore<FilaEstacio>(fetchImpl, {
    resource_id: ESTACIONS_RODALIES,
    limit: '1000',
  });
  if (r.records.length !== r.total)
    throw new SourceError(
      `Han arribat ${r.records.length} de les ${r.total} estacions de Rodalies.`,
    );
  return r.records.map((f) => ({
    codi: String(f.CÓDIGO),
    nom: f.DESCRIPCION,
    poblacio: f.POBLACION,
    latitud: f.LATITUD,
    longitud: f.LONGITUD,
  }));
}

type Paquet = {
  notes: string;
  resources: { id: string; last_modified: string | null; created: string }[];
};
const paquetRenfe = async (fetchImpl: Fetch, id: string) =>
  (await getJson<{ result: Paquet }>(fetchImpl, `${RENFE_CKAN}/package_show?id=${id}`)).result;

/** El dia que Renfe va actualitzar el recurs, de les metadades del portal. */
async function diaRecurs(fetchImpl: Fetch, paquet: string, recurs: string) {
  const r = (await paquetRenfe(fetchImpl, paquet)).resources.find((x) => x.id === recurs);
  if (!r) throw new SourceError(`data.renfe.com ja no publica el recurs ${recurs}.`);
  return (r.last_modified ?? r.created).slice(0, 10);
}

const textos = (t: { translation: Traduccio[] } | undefined) =>
  t ? t.translation.map((x) => x.text.trim()) : [];

export async function avisosRodalies(fetchImpl: Fetch) {
  const [feed, estacions] = await Promise.all([
    getJson<RenfeFeed<Alert>>(fetchImpl, `${RENFE_RT}/alerts.json`),
    estacionsRodalies(fetchImpl),
  ]);
  const nomEstacio = new Map(estacions.map((e) => [e.codi, e.nom]));
  // Un mateix avís surt repetit quan afecta moltes rutes: s'ajunten per id.
  const avisos = new Map<
    string,
    {
      id: string;
      inici?: string;
      fi?: string;
      linies: Set<string>;
      estacions: Set<string>;
      textos: string[];
    }
  >();
  for (const { id, alert } of feed.entity) {
    const linies: string[] = [];
    const estacionsAvís: string[] = [];
    for (const ent of alert.informedEntity ?? []) {
      if (ent.routeId && nucli(ent.routeId) === NUCLI_RODALIES) {
        const m = RUTA.exec(ent.routeId);
        if (!m)
          throw new SourceError(
            `Renfe ha publicat un avís amb una ruta d'identificador inesperat: ${ent.routeId}.`,
          );
        linies.push(m[2] as string);
      }
      // Els codis d'estació no porten el nucli: es reconeixen per la llista d'estacions de Rodalies.
      const nom = ent.stopId && nomEstacio.get(ent.stopId);
      if (nom) estacionsAvís.push(nom);
    }
    if (linies.length === 0 && estacionsAvís.length === 0) continue;
    const periode = alert.activePeriod?.[0];
    const a = avisos.get(id) ?? {
      id,
      inici: periode?.start && isoDeSegons(periode.start),
      fi: periode?.end && isoDeSegons(periode.end),
      linies: new Set(),
      estacions: new Set(),
      textos: [...new Set([...textos(alert.headerText), ...textos(alert.descriptionText)])],
    };
    linies.forEach((l) => a.linies.add(l));
    estacionsAvís.forEach((e) => a.estacions.add(e));
    avisos.set(id, a);
  }
  return {
    operador: 'Rodalies de Catalunya (Renfe)',
    dades_de: isoDeSegons(feed.header.timestamp),
    total: avisos.size,
    avisos: [...avisos.values()].map((a) => ({
      ...a,
      linies: [...a.linies].sort((x, y) => x.localeCompare(y, 'ca', { numeric: true })),
      estacions: [...a.estacions],
    })),
  };
}

// --- FGC ---

type Meta = { metas: { default: { data_processed: string; title: string } } };

/** Les files d'un conjunt d'FGC. L'export no té el límit de 100 files de /records. */
function exportFgc<T>(fetchImpl: Fetch, conjunt: string, params: Record<string, string> = {}) {
  return getJson<T[]>(fetchImpl, `${FGC}/${conjunt}/exports/json?${new URLSearchParams(params)}`);
}
async function dataFgc(fetchImpl: Fetch, conjunt: string) {
  const m = await getJson<Meta>(fetchImpl, `${FGC}/${conjunt}`);
  return m.metas.default.data_processed;
}

/** Els textos d'ODSQL van entre cometes simples, i una cometa s'escriu doblada. */
const cometes = (text: string) => `'${text.replaceAll("'", "''")}'`;

export type Tren = { id: string; lin: string; en_hora: string | null };

/** El camp en_hora del Geotren: «True», «False» o buit. Un altre valor és un error. */
export function enHora(t: Tren) {
  if (t.en_hora === 'True') return true;
  if (t.en_hora === 'False') return false;
  if (t.en_hora === null) return null;
  throw new SourceError(`FGC ha publicat un valor inesperat a en_hora: ${t.en_hora}.`);
}

export async function retardsFgc(fetchImpl: Fetch) {
  const [trens, dades_de] = await Promise.all([
    exportFgc<Tren>(fetchImpl, 'posicionament-dels-trens', { select: 'id,lin,en_hora' }),
    dataFgc(fetchImpl, 'posicionament-dels-trens'),
  ]);
  const perLinia = new Map<string, { en_hora: number; fora_d_hora: number; sense_dada: number }>();
  for (const t of trens) {
    const l = perLinia.get(t.lin) ?? { en_hora: 0, fora_d_hora: 0, sense_dada: 0 };
    perLinia.set(t.lin, l);
    const h = enHora(t);
    if (h === true) l.en_hora++;
    else if (h === false) l.fora_d_hora++;
    else l.sense_dada++;
  }
  return {
    operador: 'Ferrocarrils de la Generalitat de Catalunya',
    dades_de,
    criteri:
      'Si el tren va en hora segons FGC (camp en_hora del Geotren). FGC no publica els minuts de retard ni el criteri que fa servir.',
    linies: [...perLinia]
      .sort(([a], [b]) => a.localeCompare(b, 'ca', { numeric: true }))
      .map(([linia, l]) => ({
        linia,
        trens_circulant: l.en_hora + l.fora_d_hora + l.sense_dada,
        en_hora: l.en_hora,
        fora_d_hora: l.fora_d_hora,
        ...(l.sense_dada > 0 && { sense_dada: l.sense_dada }),
      })),
  };
}

export async function avisosFgc(fetchImpl: Fetch) {
  const [avisos, dades_de] = await Promise.all([
    exportFgc<Record<string, unknown>>(fetchImpl, 'avisos'),
    dataFgc(fetchImpl, 'avisos'),
  ]);
  return {
    operador: 'Ferrocarrils de la Generalitat de Catalunya',
    dades_de,
    total: avisos.length,
    avisos,
    ...(avisos.length === 0 && { nota: "FGC no publica cap avís ara mateix al conjunt d'avisos." }),
  };
}

type Parada = {
  stop_id: string;
  stop_name: string;
  stop_coordinates: { lat: number; lon: number } | null;
  wheelchair_boarding: number | null;
};

export async function estacions(fetchImpl: Fetch, operador: 'rodalies' | 'fgc' | 'tmb', q: string) {
  const cerca = words(q);
  if (operador === 'tmb') return estacionsTmb(fetchImpl, cerca);
  if (operador === 'rodalies') {
    const [totes, dades_de] = await Promise.all([
      estacionsRodalies(fetchImpl),
      diaRecurs(fetchImpl, 'estaciones-rodalies-barcelona', ESTACIONS_RODALIES),
    ]);
    return {
      operador: 'Rodalies de Catalunya (Renfe)',
      dades_de,
      nota: "És el dia que Renfe va publicar la llista d'estacions: hi poden faltar les obertes després.",
      estacions: totes.filter((e) => matches(`${e.nom} ${e.poblacio}`, cerca)),
    };
  }
  return estacionsFgc(fetchImpl, q);
}

export async function estacionsFgc(fetchImpl: Fetch, q: string) {
  const [parades, dades_de] = await Promise.all([
    exportFgc<Parada>(fetchImpl, 'gtfs_stops', { where: `search(stop_name, ${cometes(q)})` }),
    dataFgc(fetchImpl, 'gtfs_stops'),
  ]);
  // Cada estació té un codi propi (SR) i un per andana o parada de bus (SR1, SRbus): es donen les
  // estacions, amb les seves andanes al costat.
  const perNom = new Map<
    string,
    { codis: string[]; latitud?: number; longitud?: number; accessibilitat: number[] }
  >();
  for (const p of parades) {
    const e = perNom.get(p.stop_name) ?? { codis: [], accessibilitat: [] };
    perNom.set(p.stop_name, e);
    e.codis.push(p.stop_id);
    if (p.stop_coordinates) {
      e.latitud = p.stop_coordinates.lat;
      e.longitud = p.stop_coordinates.lon;
    }
    if (p.wheelchair_boarding !== null) e.accessibilitat.push(p.wheelchair_boarding);
  }
  return {
    operador: 'Ferrocarrils de la Generalitat de Catalunya',
    dades_de,
    estacions: [...perNom].map(([nom, { accessibilitat, ...e }]) => ({
      nom,
      ...e,
      accessible: accessible(accessibilitat),
    })),
  };
}

/**
 * En GTFS, 1 vol dir accessible, 2 no accessible i 0 sense informació. Si les andanes d'una estació
 * diuen coses diferents, es diu així.
 */
function accessible(valors: number[]) {
  const coneguts = new Set(valors.filter((v) => v !== 0));
  for (const v of coneguts)
    if (v !== 1 && v !== 2)
      throw new SourceError(`FGC ha publicat un wheelchair_boarding inesperat: ${v}.`);
  if (coneguts.size === 0) return 'sense informació';
  if (coneguts.size === 2) return 'segons l’andana';
  return coneguts.has(1) ? 'sí' : 'no';
}

type Ruta = { route_short_name: string; route_long_name: string; route_color: string | null };

export async function liniesFgc(fetchImpl: Fetch) {
  const [rutes, dades_de] = await Promise.all([
    exportFgc<Ruta>(fetchImpl, 'gtfs_routes', {
      select: 'route_short_name,route_long_name,route_color',
    }),
    dataFgc(fetchImpl, 'gtfs_routes'),
  ]);
  return {
    operador: 'Ferrocarrils de la Generalitat de Catalunya',
    dades_de,
    linies: rutes
      .map((r) => ({ linia: r.route_short_name, recorregut: r.route_long_name }))
      .sort((a, b) => a.linia.localeCompare(b.linia, 'ca', { numeric: true })),
  };
}

type Pas = {
  date: string;
  route_short_name: string;
  trip_headsign: string;
  departure_time: string;
  platform_code: number | null;
};

/** GTFS escriu les hores passada la mitjanit com a 24:10: es comparen amb zeros al davant. */
const hora = (h: string) => h.padStart(8, '0');

export async function horarisFgc(
  fetchImpl: Fetch,
  args: { estacio: string; des_de?: string; limit: number },
  ara = new Date(),
) {
  const passos = await exportFgc<Pas>(fetchImpl, 'viajes-de-hoy', {
    where: `stop_name = ${cometes(args.estacio)}`,
    select: 'date,route_short_name,trip_headsign,departure_time,platform_code',
  });
  if (passos.length === 0)
    throw new SourceError(
      `Cap tren d'FGC passa avui per «${args.estacio}». El nom ha de ser exacte, amb accents: busca'l amb estacions.`,
    );
  const dies = [...new Set(passos.map((p) => p.date.slice(0, 10)))];
  if (dies.length !== 1)
    throw new SourceError(`FGC barreja els horaris de més d'un dia: ${dies.join(', ')}.`);
  const dia = dies[0] as string;
  const desDe = args.des_de ?? horaLocal(ara);
  // Passada la mitjanit, FGC encara publica els horaris del dia de servei anterior, que escriuen
  // les 00.35 com a 24:35: l'hora demanada se suma a les 24 per comparar-la.
  const servei = dia < diaLocal(ara) ? `${Number(desDe.slice(0, 2)) + 24}${desDe.slice(2)}` : desDe;
  const propers = passos
    .filter((p) => hora(p.departure_time) >= hora(`${servei}:00`))
    .sort((a, b) => hora(a.departure_time).localeCompare(hora(b.departure_time)));
  return {
    operador: 'Ferrocarrils de la Generalitat de Catalunya',
    dia,
    estacio: args.estacio,
    des_de: desDe,
    nota: "Horaris previstos d'avui segons FGC, no l'hora real de pas: per saber si un tren va en hora, fes servir retards.",
    total: propers.length,
    trens: propers.slice(0, args.limit).map((p) => ({
      sortida: hora(p.departure_time).slice(0, 5),
      linia: p.route_short_name,
      direccio: p.trip_headsign,
      andana: p.platform_code,
    })),
  };
}

// --- TMB ---

/** Una crida a l'API de TMB amb la clau de l'entorn. La clau no surt mai en cap missatge. */
export function clauTmb() {
  const app_id = process.env.TMB_APP_ID;
  const app_key = process.env.TMB_APP_KEY;
  if (!app_id || !app_key)
    throw new SourceError(
      'Aquest servidor no té la clau de TMB: cal definir TMB_APP_ID i TMB_APP_KEY (es demanen a developer.tmb.cat).',
    );
  return { app_id, app_key };
}

function tmb<T>(fetchImpl: Fetch, cami: string, params: Record<string, string> = {}) {
  return getJson<T>(
    fetchImpl,
    `${TMB}/${cami}?${new URLSearchParams({ ...params, ...clauTmb() })}`,
  );
}

type Geo<P> = { features: { properties: P }[] };
export type AlertaMetro = {
  id: number;
  disruption_dates: { begin_date: number; end_date: number | null }[];
  entities: { line_name: string; station_name: string | null }[];
  publications: { headerCa: string; textCa: string }[];
};
export type AlertaBus = {
  id: number;
  begin: number;
  end: number | null;
  causeName: string;
  typeName: string;
  linesAffected: { commercialLineId: string }[];
  channelInfoTO: { textCa: string };
};
export type Estat<T> = { status: string; data: T };

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const unics = (xs: (string | null)[]) => [...new Set(xs.filter((x) => x !== null))] as string[];

export async function avisosTmb(fetchImpl: Fetch, ara = new Date()) {
  const [metro, bus] = await Promise.all([
    tmb<Estat<{ alerts: AlertaMetro[] }>>(fetchImpl, 'alerts/metro/channels/WEB'),
    tmb<Estat<{ alerts: AlertaBus[] }>>(fetchImpl, 'alerts/bus/channels/WEB'),
  ]);
  return {
    operador: 'Transports Metropolitans de Barcelona',
    dades_de: ara.toISOString(),
    ...llegeixAvisosTmb(metro, bus),
  };
}

/** Els avisos de metro i de bus tal com els publica TMB, amb el text sense HTML. */
export function llegeixAvisosTmb(
  metro: Estat<{ alerts: AlertaMetro[] }>,
  bus: Estat<{ alerts: AlertaBus[] }>,
) {
  for (const r of [metro, bus])
    if (r.status !== 'success') throw new SourceError(`TMB ha respost l'estat ${r.status}.`);
  return {
    metro: metro.data.alerts.map((a) => ({
      id: a.id,
      inici: iso(a.disruption_dates[0]?.begin_date ?? null),
      fi: iso(a.disruption_dates[0]?.end_date ?? null),
      linies: unics(a.entities.map((e) => e.line_name)),
      estacions: unics(a.entities.map((e) => e.station_name)),
      textos: a.publications.map((p) => text(`${p.headerCa}. ${p.textCa}`)),
    })),
    bus: bus.data.alerts.map((a) => ({
      id: a.id,
      inici: iso(a.begin),
      fi: iso(a.end),
      linies: unics(a.linesAffected.map((l) => l.commercialLineId)),
      causa: a.causeName,
      tipus: a.typeName,
      text: text(a.channelInfoTO.textCa),
    })),
  };
}

type EstacioLinia = { CODI_ESTACIO: number; NOM_ESTACIO: string; NOM_LINIA: string };
type ParadaBus = { CODI_PARADA: number; NOM_PARADA: string };

const estacionsMetro = (fetchImpl: Fetch) =>
  tmb<Geo<EstacioLinia>>(fetchImpl, 'transit/linies/metro/estacions', {
    propertyName: 'CODI_ESTACIO,NOM_ESTACIO,NOM_LINIA',
  });

async function estacionsTmb(fetchImpl: Fetch, cerca: string[]) {
  const [metro, parades] = await Promise.all([
    estacionsMetro(fetchImpl),
    tmb<Geo<ParadaBus>>(fetchImpl, 'transit/parades', { propertyName: 'CODI_PARADA,NOM_PARADA' }),
  ]);
  const perNom = agrupa(
    metro.features.map((f) => f.properties).filter((e) => matches(e.NOM_ESTACIO, cerca)),
    (e) => e.NOM_ESTACIO,
  );
  return {
    operador: 'Transports Metropolitans de Barcelona',
    metro: [...perNom].map(([nom, ls]) => ({
      nom,
      linies: ls
        .map((l) => l.NOM_LINIA)
        .sort((a, b) => a.localeCompare(b, 'ca', { numeric: true })),
    })),
    parades_bus: parades.features
      .map((f) => f.properties)
      .filter((p) => matches(p.NOM_PARADA, cerca))
      .map((p) => ({ codi: p.CODI_PARADA, nom: p.NOM_PARADA })),
  };
}

type ITransit = {
  timestamp: number;
  linies: {
    nom_linia: string;
    estacions: {
      linies_trajectes: {
        desti_trajecte: string;
        propers_trens: { temps_arribada: number }[];
      }[];
    }[];
  }[];
};
type IBus = { line: string; destination: string; 't-in-s': number; 't-in-min': number };

export async function propersTmb(
  fetchImpl: Fetch,
  args: { metro: string } | { parada_bus: number },
  ara = new Date(),
) {
  if ('metro' in args) {
    const nom = args.metro;
    const codis = (await estacionsMetro(fetchImpl)).features
      .map((f) => f.properties)
      .filter((e) => e.NOM_ESTACIO === nom)
      .map((e) => e.CODI_ESTACIO);
    if (codis.length === 0)
      throw new SourceError(
        `TMB no té cap estació de metro que es digui «${nom}». El nom ha de ser exacte: busca'l amb estacions.`,
      );
    const r = await tmb<ITransit>(fetchImpl, 'itransit/metro/estacions', {
      estacions: codis.join(','),
    });
    return {
      operador: 'Transports Metropolitans de Barcelona',
      dades_de: iso(r.timestamp),
      estacio: nom,
      trens: r.linies.flatMap((l) =>
        l.estacions.flatMap((e) =>
          e.linies_trajectes.map((t) => ({
            linia: l.nom_linia,
            direccio: t.desti_trajecte,
            arribades_min: t.propers_trens.map((p) =>
              Math.max(0, Math.round((p.temps_arribada - r.timestamp) / 60_000)),
            ),
          })),
        ),
      ),
    };
  }
  const r = await tmb<Estat<{ ibus: IBus[] }>>(fetchImpl, `ibus/stops/${args.parada_bus}`);
  if (r.status !== 'success') throw new SourceError(`TMB ha respost l'estat ${r.status}.`);
  return {
    operador: 'Transports Metropolitans de Barcelona',
    dades_de: ara.toISOString(),
    parada_bus: args.parada_bus,
    busos: r.data.ibus.map((b) => ({
      linia: b.line,
      direccio: b.destination,
      arribada_min: b['t-in-min'],
    })),
    ...(r.data.ibus.length === 0 && {
      nota: 'TMB no preveu cap bus en aquesta parada ara mateix, o el codi de parada no existeix: comprova-ho amb estacions.',
    }),
  };
}

// --- Demanda ---

const DEMANDA_RODALIES = '1417396e-4d6a-466a-a987-03d07aa92bed';
type Franja = {
  NOMBRE_ESTACION: string;
  TRAMO_HORARIO: string;
  VIAJEROS_SUBIDOS: number;
  VIAJEROS_BAJADOS: number;
};
type MesosFgc = Record<string, unknown> & {
  any: string;
  linia: string;
  estacio: string;
  total: number | null;
};

export async function demanda(
  fetchImpl: Fetch,
  operador: 'rodalies' | 'fgc',
  estacio: string,
  any?: number,
) {
  if (operador === 'rodalies') {
    const [r, paquet] = await Promise.all([
      datastore<Franja>(fetchImpl, { resource_id: DEMANDA_RODALIES, q: estacio, limit: '1000' }),
      paquetRenfe(fetchImpl, 'volumen-de-viajeros-por-franja-horaria-barcelona'),
    ]);
    // L'any només el diu la descripció del conjunt: «… cercanías Barcelona, año 2018».
    const anyDades = /\baño (\d{4})\b/.exec(paquet.notes)?.[1];
    if (anyDades === undefined)
      throw new SourceError('Renfe no diu de quin any és la demanda de Rodalies.');
    if (r.records.length !== r.total)
      throw new SourceError(`Han arribat ${r.records.length} de les ${r.total} franges.`);
    const cerca = words(estacio);
    const files = r.records.filter((f) => matches(f.NOMBRE_ESTACION, cerca));
    if (files.length === 0)
      throw new SourceError(
        `Renfe no publica la demanda de cap estació que es digui «${estacio}».`,
      );
    const perEstacio = agrupa(files, (f) => f.NOMBRE_ESTACION);
    return {
      operador: 'Rodalies de Catalunya (Renfe)',
      any: Number(anyDades),
      unitat:
        'Viatgers que pugen i baixen en cada franja de mitja hora, segons Renfe. Renfe no diu de quin tipus de dia són.',
      estacions: [...perEstacio].map(([nom, franges]) => ({
        estacio: nom,
        franges: franges.map((f) => ({
          franja: f.TRAMO_HORARIO,
          pugen: f.VIAJEROS_SUBIDOS,
          baixen: f.VIAJEROS_BAJADOS,
        })),
      })),
    };
  }
  const condicions = [`search(estacio, ${cometes(estacio)})`];
  if (any !== undefined) condicions.push(`any = ${cometes(String(any))}`);
  const files = await exportFgc<MesosFgc>(fetchImpl, 'demanda-mensual-per-estacio-2019-2024', {
    where: condicions.join(' and '),
    order_by: 'any desc',
  });
  if (files.length === 0)
    throw new SourceError(
      `FGC no publica la demanda de cap estació que es digui «${estacio}»${any ? ` el ${any}` : ''}. Els anys publicats van del 2019 al 2024.`,
    );
  return {
    operador: 'Ferrocarrils de la Generalitat de Catalunya',
    unitat: 'Viatgers de cada estació cada mes, segons FGC.',
    files,
  };
}

export function createTransportServer(fetchImpl: Fetch = fetch) {
  const s = new McpServer(
    { name: 'finestra-oberta-transport', title: 'Transport públic', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );
  s.registerTool(
    'retards',
    {
      title: 'Retards ara',
      description:
        "Els trens que circulen ara mateix, per línia, i com van d'hora. De Rodalies: el retard en minuts que publica Renfe (mitjana, màxim i quants porten 5 minuts o més) i els trens cancel·lats. D'FGC: quants van en hora i quants no, segons FGC.",
      inputSchema: z.object({ operador: OPERADOR }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ operador }) =>
      run<unknown>(SOURCE, () =>
        operador === 'rodalies' ? retardsRodalies(fetchImpl) : retardsFgc(fetchImpl),
      ),
  );
  s.registerTool(
    'avisos',
    {
      title: 'Avisos i incidències',
      description:
        "Els avisos vigents de l'operador: incidències, obres, desviaments, serveis alternatius per carretera, ascensors fora de servei. De Rodalies i TMB, amb les línies i les estacions afectades i el text tal com el publica l'operador.",
      inputSchema: z.object({ operador: OPERADOR_TMB }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ operador }) =>
      run<unknown>(SOURCE, () =>
        operador === 'rodalies'
          ? avisosRodalies(fetchImpl)
          : operador === 'fgc'
            ? avisosFgc(fetchImpl)
            : avisosTmb(fetchImpl),
      ),
  );
  s.registerTool(
    'estacions',
    {
      title: 'Estacions',
      description:
        "Les estacions de l'operador el nom de les quals conté les paraules de `q` (sense distingir accents). D'FGC, amb les coordenades, els codis de les andanes i si és accessible; de Rodalies, amb el codi, el municipi i les coordenades; de TMB, les estacions de metro amb les seves línies i les parades de bus amb el codi que fa servir propers_tmb.",
      inputSchema: z.object({ operador: OPERADOR_TMB, q: z.string().min(2).max(80) }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ operador, q }) => run(SOURCE, () => estacions(fetchImpl, operador, q)),
  );
  s.registerTool(
    'linies_fgc',
    {
      title: "Línies d'FGC",
      description: "Les línies d'FGC amb el seu recorregut, del GTFS que publica FGC.",
      inputSchema: z.object({}),
      annotations: READ_ONLY_EXTERNAL,
    },
    () => run(SOURCE, () => liniesFgc(fetchImpl)),
  );
  s.registerTool(
    'horaris_fgc',
    {
      title: "Propers trens d'FGC",
      description:
        "Els trens previstos avui en una estació d'FGC a partir d'una hora (per defecte, ara), amb la línia, la direcció i l'andana.",
      inputSchema: z.object({
        estacio: z.string().min(2).max(80).describe("Nom exacte de l'estació, d'estacions."),
        des_de: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional()
          .describe('Hora local, HH:MM. Per defecte, ara.'),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      annotations: READ_ONLY_EXTERNAL,
    },
    (args) => run(SOURCE, () => horarisFgc(fetchImpl, args)),
  );
  s.registerTool(
    'propers_tmb',
    {
      title: 'Propers metros i busos de TMB',
      description:
        'Els minuts que falten perquè arribin els propers metros a una estació, per línia i direcció, o els propers busos a una parada, segons TMB en temps real.',
      inputSchema: z
        .object({
          metro: z
            .string()
            .min(2)
            .max(80)
            .optional()
            .describe("Nom exacte de l'estació de metro, d'estacions."),
          parada_bus: z
            .number()
            .int()
            .min(1)
            .max(999999)
            .optional()
            .describe("Codi de la parada de bus, d'estacions."),
        })
        .refine((a) => (a.metro === undefined) !== (a.parada_bus === undefined), {
          message: 'Indica o bé una estació de metro (metro) o bé una parada de bus (parada_bus).',
        }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ metro, parada_bus }) =>
      run(SOURCE, () =>
        propersTmb(
          fetchImpl,
          // L'esquema ja ha comprovat que n'hi ha un i només un.
          metro !== undefined ? { metro } : { parada_bus: parada_bus as number },
        ),
      ),
  );
  s.registerTool(
    'demanda',
    {
      title: 'Viatgers per estació',
      description:
        "Quants viatgers fan servir una estació. De Rodalies: els que pugen i baixen per franja de mitja hora, d'un sol any, que diu la resposta. D'FGC: els de cada mes, del 2019 al 2024.",
      inputSchema: z
        .object({
          operador: OPERADOR,
          estacio: z.string().min(2).max(80),
          any: z.number().int().min(2019).max(2024).optional().describe("Només FGC: l'any."),
        })
        .refine((a) => a.operador === 'fgc' || a.any === undefined, {
          message: "Rodalies només publica la demanda d'un any: no se'n pot triar cap.",
        }),
      annotations: READ_ONLY_EXTERNAL,
    },
    ({ operador, estacio, any }) => run(SOURCE, () => demanda(fetchImpl, operador, estacio, any)),
  );
  return s;
}
