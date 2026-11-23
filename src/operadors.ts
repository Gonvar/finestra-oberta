// El que llegeixen tant el servidor MCP del transport com l'històric: les adreces dels operadors,
// la forma de les seves respostes i com se'n llegeixen els camps. Sense dependències, perquè el
// workflow de l'històric no ha d'instal·lar cap paquet de tercers en un pas que té les claus.
import { SourceError, text } from './comun.ts';

export const FGC = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets';

export const RENFE_RT = 'https://gtfsrt.renfe.com';

export const TMB = 'https://api.tmb.cat/v1';

export type RenfeFeed<E> = { header: { timestamp: string }; entity: E[] };

export type TripUpdate = {
  id: string;
  tripUpdate: {
    trip: { tripId: string; scheduleRelationship?: string };
    delay?: number;
    stopTimeUpdate?: { arrival?: { delay?: number } }[];
  };
};

/**
 * El feed de Renfe és de tot l'Estat. Els dos primers dígits dels viatges i de les rutes són el
 * nucli de rodalies, i el 51 és el de Barcelona, és a dir, Rodalies de Catalunya: «5126L28416R2N»,
 * «SPECIAL_51_91025R2», «51T0025R2». Després hi ha el número del tren i, al final, la línia: R2N, R2.
 */
export const NUCLI_RODALIES = '51';

export const VIATGE = /^(?:SPECIAL_(\d{2})_|(\d{2})\d{2}L)\d+([A-Z][A-Za-z0-9]*)$/;

export const RUTA = /^(\d{2})T\d+([A-Z][A-Za-z0-9]*)$/;

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

export type Tren = { id: string; lin: string; en_hora: string | null };

/** El camp en_hora del Geotren: «True», «False» o buit. Un altre valor és un error. */
export function enHora(t: Tren) {
  if (t.en_hora === 'True') return true;
  if (t.en_hora === 'False') return false;
  if (t.en_hora === null) return null;
  throw new SourceError(`FGC ha publicat un valor inesperat a en_hora: ${t.en_hora}.`);
}

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

export const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

export const unics = (xs: (string | null)[]) =>
  [...new Set(xs.filter((x) => x !== null))] as string[];

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
