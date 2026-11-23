// El perfil de cada persona diputada: la composició de parlament.json i el que diu la seva fitxa, de
// diputats.json. Les xifres es calculen amb la mateixa regla per a tothom, i no ordenen ningú.
import diputatsJson from '../../../dades/diputats.json' with { type: 'json' };
import type { ActeParlament } from '../../../src/agenda.ts';
import type { Biografia, Declaracio, ElementCarrec } from '../../../src/diputats.ts';
import { parlament, slug } from './institucions.ts';

export type { Bloc } from '../../../src/diputats.ts';
export type Carrec = ElementCarrec;
export type Acte = ActeParlament;

// Els tipus són els de l'scraper i no els que s'inferirien del JSON: un JSON d'un dia concret pot no
// tenir cap exemple d'un camp opcional, i llavors el tipus el donaria per obligatori o inexistent.
export type Fitxa = {
  codi: string;
  nom: string;
  fitxa: string;
  carrecs: Carrec[];
  biografia?: Biografia;
  rendes?: Declaracio & { anualitats: { any: number; conceptes: { concepte: string; import: number }[] }[] };
  declaracions: Declaracio[];
  compromisos: { titol: string; url: string }[];
  agenda: { url: string; actes: Acte[] };
};

// El JSON perd els tipus literals («Presentació» passa a string): el valida l'scraper en escriure'l.
export const diputats = diputatsJson as {
  font: string;
  data_consulta: string;
  agenda: { any: number; mes: number };
  diputats: Fitxa[];
};

export type Composicio = (typeof parlament.diputats)[number];

export const codi = (fitxa: string) => {
  const c = new URL(fitxa).searchParams.get('p_codi');
  if (c === null) throw new Error(`La fitxa ${fitxa} no té codi.`);
  return c;
};

// El càrrec de la composició pot ser «Consellera» o «President del Parlament», que no són per cap
// circumscripció: només el de diputat o diputada va amb el «per».
export const presentacio = (c: Composicio) =>
  c.carrec === 'Diputat' || c.carrec === 'Diputada'
    ? `${c.carrec} per ${c.circumscripcio}`
    : `Persona diputada per ${c.circumscripcio}. ${c.carrec}`;

export const rutaDiputat = (nom: string) => `/parlament/${slug(nom)}/`;

export type Diputat = { composicio: Composicio; fitxa: Fitxa; ruta: string };

// Una persona de la composició sense fitxa, o al revés, vol dir que els dos fitxers no són del mateix
// dia: val més no construir la web que mostrar un perfil a mitges.
export const perfils: Diputat[] = parlament.diputats.map((composicio) => {
  const trobades = diputats.diputats.filter((f) => f.codi === codi(composicio.fitxa));
  if (trobades.length !== 1)
    throw new Error(`${composicio.nom} té ${trobades.length} fitxes a diputats.json, no una.`);
  return { composicio, fitxa: trobades[0]!, ruta: rutaDiputat(composicio.nom) };
});
if (perfils.length !== diputats.diputats.length)
  throw new Error(
    `diputats.json té ${diputats.diputats.length} fitxes i parlament.json, ${perfils.length} persones.`,
  );
if (new Set(perfils.map((p) => p.ruta)).size !== perfils.length)
  throw new Error('Dues persones diputades tenen la mateixa adreça.');

// Un contenidor sense dates és la comissió de qui només és a una ponència: no hi és ell mateix.
export function organsActuals(carrecs: Carrec[]) {
  return carrecs.flatMap((c) => [
    ...('alta' in c && c.baixa === undefined ? [c] : []),
    ...(c.relacionats === undefined ? [] : c.relacionats.filter((r) => r.baixa === undefined)),
  ]);
}

// Un acte desconvocat no s'ha fet: no compta a cap xifra, però la llista el mostra.
export const actesFets = (actes: Acte[]) => actes.filter((a) => a.desconvocat === undefined);

// El Parlament no marca les reunions amb grups d'interès amb cap camp: només amb aquesta línia.
export const ambGrupInteres = (actes: Acte[]) =>
  actesFets(actes).filter((a) => a.detalls.some((d) => d.startsWith("Grup d'interès:")));

// L'any més recent i no l'últim de la llista, perquè l'scraper conserva l'ordre de la pàgina. Una
// fila de total es comptaria dues vegades, i per això atura el build en lloc de sumar-se.
export function rendesDarrerAny(fitxa: Fitxa) {
  if (fitxa.rendes === undefined || fitxa.rendes.anualitats.length === 0) return undefined;
  const darrera = fitxa.rendes.anualitats.reduce((a, b) => (b.any > a.any ? b : a));
  const total = darrera.conceptes.find((c) => /total/i.test(c.concepte));
  if (total !== undefined)
    throw new Error(`Les rendes de ${fitxa.nom} tenen una fila de total: «${total.concepte}».`);
  return { any: darrera.any, total: darrera.conceptes.reduce((s, c) => s + c.import, 0) };
}

// «el 3 de març», però «l’1 de març» i «l’11 de març». L’apòstrof és el tipogràfic, com el d’Intl.
export const elDia = (data: string) => (/^1?1 /.test(data) ? `l’${data}` : `el ${data}`);
export const delDia = (data: string) => {
  const a = elDia(data);
  return a.startsWith('el ') ? `d${a}` : `de ${a}`;
};
export const alDia = (data: string) => {
  const a = elDia(data);
  return a.startsWith('el ') ? `a${a.slice(1)}` : `a ${a}`;
};

const MESOS = [
  'gener',
  'febrer',
  'març',
  'abril',
  'maig',
  'juny',
  'juliol',
  'agost',
  'setembre',
  'octubre',
  'novembre',
  'desembre',
];

export function deMes(mes: number) {
  const nom = MESOS[mes - 1];
  if (nom === undefined) throw new Error(`El mes ${mes} no existeix.`);
  return /^[aeiou]/.test(nom) ? `d’${nom}` : `de ${nom}`;
}
