// El perfil de cada persona diputada: la composició de parlament.json i el que diu la seva fitxa, de
// diputats.json. Les xifres es calculen amb la mateixa regla per a tothom, i no ordenen ningú.
import diputatsJson from '../../../dades/diputats.json' with { type: 'json' };
import { parlament, slug } from './institucions.ts';

export const diputats = diputatsJson;

export type Fitxa = (typeof diputats.diputats)[number];
export type Composicio = (typeof parlament.diputats)[number];
export type Carrec = Fitxa['carrecs'][number];
export type Declaracio = Fitxa['declaracions'][number];
export type Bloc = Declaracio['blocs'][number];
export type Acte = Fitxa['agenda']['actes'][number];

export const codi = (fitxa: string) => {
  const c = new URL(fitxa).searchParams.get('p_codi');
  if (c === null) throw new Error(`La fitxa ${fitxa} no té codi.`);
  return c;
};

/** L'adreça del perfil dins del web. */
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

/** Els òrgans on la persona és ara: els que no tenen data de baixa. Un contenidor sense dates no compta. */
export function organsActuals(carrecs: Carrec[]) {
  return carrecs.flatMap((c) => [
    ...('alta' in c && !('baixa' in c) ? [c] : []),
    ...('relacionats' in c ? c.relacionats.filter((r) => !('baixa' in r)) : []),
  ]);
}

/** Les reunions amb grups d'interès: el Parlament les marca amb aquesta línia al detall de l'acte. */
export const ambGrupInteres = (actes: Acte[]) =>
  actes.filter((a) => a.detalls.some((d) => d.startsWith("Grup d'interès:")));

/** El total de l'última anualitat publicada, sumant-ne tots els conceptes. */
export function rendesDarrerAny(fitxa: Fitxa) {
  if (!('rendes' in fitxa)) return undefined;
  const darrera = fitxa.rendes.anualitats.at(-1);
  if (darrera === undefined) return undefined;
  return { any: darrera.any, total: darrera.conceptes.reduce((s, c) => s + c.import, 0) };
}

/** La mediana dels totals d'un any: la meitat de les persones van cobrar menys i la meitat, més. */
export function mediana(xifres: number[]) {
  if (xifres.length === 0) throw new Error('No es pot calcular la mediana de cap xifra.');
  const ordenades = [...xifres].sort((a, b) => a - b);
  const mig = Math.floor(ordenades.length / 2);
  return ordenades.length % 2 ? ordenades[mig]! : (ordenades[mig - 1]! + ordenades[mig]!) / 2;
}

export function medianaRendes(any: number) {
  const totals = perfils.flatMap((p) => {
    const r = rendesDarrerAny(p.fitxa);
    return r && r.any === any ? [r.total] : [];
  });
  return { mediana: mediana(totals), persones: totals.length };
}

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

/** «de novembre», «d'abril»: el mes, amb la preposició que li toca. */
export function deMes(mes: number) {
  const nom = MESOS[mes - 1];
  if (nom === undefined) throw new Error(`El mes ${mes} no existeix.`);
  return /^[aeiou]/.test(nom) ? `d'${nom}` : `de ${nom}`;
}
