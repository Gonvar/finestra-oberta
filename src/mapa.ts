// Els límits de cada municipi, de l'Institut Cartogràfic i Geològic de Catalunya (ICGC), per al mapa
// de la web. No és un servidor MCP: src/dades.ts ho desa a la branca `dades`. La geometria es desa tal
// com la dona l'ICGC: qui la dibuixi la pot simplificar, però el fitxer no.
import { getJson, SourceError, type Fetch } from './comun.ts';

const WFS = 'https://geoserveis.icgc.cat/servei/catalunya/divisions-administratives/wfs';
// La capa més generalitzada, a escala 1:1.000.000: n'hi ha prou per a un mapa de tot Catalunya.
export const CAPA = 'divisions_administratives_wfs:divisions_administratives_municipis_1000000';
export const CONDICIONS_ICGC = 'http://www.icgc.cat/condicions';

type Posicio = [number, number];
type Geometria =
  | { type: 'Polygon'; coordinates: Posicio[][] }
  | { type: 'MultiPolygon'; coordinates: Posicio[][][] };

const esPosicio = (p: unknown): p is Posicio =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every((x) => typeof x === 'number' && Number.isFinite(x)) &&
  // Dins de Catalunya, en graus: si arriben en metres (EPSG:25831), la consulta ha canviat.
  (p[0] as number) > -1 &&
  (p[0] as number) < 4 &&
  (p[1] as number) > 40 &&
  (p[1] as number) < 43.5;

// Un anell de GeoJSON és tancat: l'últim punt és el primer.
function esAnell(a: unknown) {
  if (!Array.isArray(a) || a.length < 4 || !a.every(esPosicio)) return false;
  const [primer, darrer] = [a[0] as Posicio, a[a.length - 1] as Posicio];
  return primer[0] === darrer[0] && primer[1] === darrer[1];
}
const esPoligon = (p: unknown) => Array.isArray(p) && p.length >= 1 && p.every(esAnell);

function geometria(g: unknown, codi: string): Geometria {
  const { type, coordinates } = (g ?? {}) as { type?: unknown; coordinates?: unknown };
  if (type === 'Polygon' && esPoligon(coordinates)) return g as Geometria;
  if (
    type === 'MultiPolygon' &&
    Array.isArray(coordinates) &&
    coordinates.length >= 1 &&
    coordinates.every(esPoligon)
  )
    return g as Geometria;
  throw new SourceError(`La geometria del municipi ${codi} no té la forma esperada.`);
}

/**
 * `codis` són els municipis de Municat: el mapa ha de tenir els mateixos, o algun municipi no es podria
 * triar al mapa.
 */
export async function construirMapa(fetchImpl: Fetch, codis: Set<string>, avui: string) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: CAPA,
    outputFormat: 'GEOJSON',
    srsName: 'EPSG:4326',
  });
  const dades = await getJson<{ type?: unknown; features?: unknown }>(
    fetchImpl,
    `${WFS}?${params}`,
  );
  if (dades.type !== 'FeatureCollection' || !Array.isArray(dades.features))
    throw new SourceError('El servei de l’ICGC no ha tornat una col·lecció de municipis.');
  // Un mapa buit faria llistar tots els municipis de Municat com a absents, i amagaria la causa.
  if (dades.features.length === 0)
    throw new SourceError('El servei de l’ICGC ha tornat el mapa sense cap municipi.');

  const municipis = new Map<string, { nom: string; geometria: Geometria }>();
  for (const feature of dades.features as unknown[]) {
    const { properties, geometry } = (feature ?? {}) as {
      properties?: unknown;
      geometry?: unknown;
    };
    const { CODIMUNI: codi, NOMMUNI: nom } = (properties ?? {}) as Record<string, unknown>;
    if (typeof codi !== 'string' || !/^\d{6}$/.test(codi) || typeof nom !== 'string' || nom === '')
      throw new SourceError(
        `Un municipi de l’ICGC no té codi o nom: ${String(JSON.stringify(properties)).slice(0, 200)}.`,
      );
    if (municipis.has(codi))
      throw new SourceError(`El municipi ${codi} surt dues vegades al mapa.`);
    municipis.set(codi, { nom, geometria: geometria(geometry, codi) });
  }

  const falten = [...codis].filter((c) => !municipis.has(c));
  const sobren = [...municipis.keys()].filter((c) => !codis.has(c));
  if (falten.length > 0 || sobren.length > 0)
    throw new SourceError(
      `Els municipis del mapa i els de Municat no coincideixen (falten ${falten.join(', ') || 'cap'}; sobren ${sobren.join(', ') || 'cap'}).`,
    );

  return {
    font: 'Institut Cartogràfic i Geològic de Catalunya (ICGC): divisions administratives, municipis a escala 1:1.000.000',
    url: `${WFS}?service=WFS&request=GetCapabilities`,
    condicions: CONDICIONS_ICGC,
    // El servei no diu quan es van actualitzar els límits: només se sap quan s'han llegit.
    data_consulta: avui,
    nota: 'Els límits de cada municipi, en graus (EPSG:4326), tal com els dona el servei WFS de l’ICGC. L’escala 1:1.000.000 és la més simplificada de l’ICGC: serveix per a un mapa de tot Catalunya, no per saber per on passa exactament un límit.',
    municipis: [...municipis]
      .map(([codi, { nom, geometria }]) => ({ codi, nom, geometria }))
      .sort((a, b) => a.codi.localeCompare(b.codi)),
  };
}
