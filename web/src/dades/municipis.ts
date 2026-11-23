// Els municipis, tal com els desa src/dades.ts a dades/: el ple de Municat, els indicadors de
// l'Idescat, els vots de les últimes municipals i els límits de l'ICGC. Els quatre fitxers han de
// tenir els mateixos municipis: si no, la web no es construeix, perquè una fitxa quedaria a mitges.
import ajuntaments from '../../../dades/ajuntaments.json' with { type: 'json' };
import eleccions from '../../../dades/eleccions-municipals.json' with { type: 'json' };
import mapa from '../../../dades/mapa-municipis.json' with { type: 'json' };
import indicadors from '../../../dades/municipis.json' with { type: 'json' };
import { slug } from './institucions.ts';

export { ajuntaments, eleccions, indicadors, mapa };

type Ajuntament = (typeof ajuntaments.municipis)[number];
type Indicadors = (typeof indicadors.municipis)[number];
type Eleccio = (typeof eleccions.municipis)[number];
type Limits = (typeof mapa.municipis)[number];

export type Municipi = Ajuntament & {
  ruta: string;
  valors: Indicadors['valors'];
  candidatures: Eleccio['candidatures'];
  geometria: Limits['geometria'];
};

function perCodi<T extends { codi: string }>(llista: T[], fitxer: string) {
  const mapaCodis = new Map(llista.map((x) => [x.codi, x]));
  if (mapaCodis.size !== llista.length) throw new Error(`${fitxer} repeteix algun municipi.`);
  return (codi: string) => {
    const trobat = mapaCodis.get(codi);
    if (trobat === undefined) throw new Error(`El municipi ${codi} no és a ${fitxer}.`);
    return trobat;
  };
}

const deIndicadors = perCodi(indicadors.municipis, 'municipis.json');
const deEleccions = perCodi(eleccions.municipis, 'eleccions-municipals.json');
const deMapa = perCodi(mapa.municipis as Limits[], 'mapa-municipis.json');

for (const [fitxer, n] of [
  ['municipis.json', indicadors.municipis.length],
  ['eleccions-municipals.json', eleccions.municipis.length],
  ['mapa-municipis.json', mapa.municipis.length],
] as const)
  if (n !== ajuntaments.municipis.length)
    throw new Error(
      `${fitxer} té ${n} municipis i ajuntaments.json en té ${ajuntaments.municipis.length}.`,
    );

// Municat diu «Ajuntament de Barcelona» tant al nom de l'ens com al de l'ajuntament; el nom del
// municipi és el de l'Idescat.
export const municipis: Municipi[] = ajuntaments.municipis.map((m) => ({
  ...m,
  nom: deIndicadors(m.codi).nom,
  ruta: `/municipis/${slug(deIndicadors(m.codi).nom)}/`,
  valors: deIndicadors(m.codi).valors,
  candidatures: deEleccions(m.codi).candidatures,
  geometria: deMapa(m.codi).geometria,
}));

if (new Set(municipis.map((m) => m.ruta)).size !== municipis.length)
  throw new Error('Dos municipis tenen la mateixa adreça.');

export type IdIndicador = keyof Indicadors['valors'];

export function indicador(id: IdIndicador) {
  const trobat = indicadors.indicadors.find((i) => i.id === id);
  if (trobat === undefined) throw new Error(`municipis.json no té l'indicador ${id}.`);
  return trobat;
}

/** Una part d'un total, en percentatge amb un decimal, o null si l'Idescat no dona alguna de les dues. */
export function percentatge(part: number | null, total: number | null) {
  if (part === null || total === null) return null;
  if (total <= 0) throw new Error(`Un total de l'Idescat és ${total}.`);
  return Math.round((part / total) * 1000) / 10;
}
