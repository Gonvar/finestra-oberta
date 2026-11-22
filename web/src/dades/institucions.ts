// El Govern i el Parlament, tal com els desa src/dades.ts a dades/. Si una persona del Govern no té
// les dades de transparència, la web no es construeix: val més un error que una fitxa a mitges.
import govern from '../../../dades/govern.json';
import parlament from '../../../dades/parlament.json';
import transparencia from '../../../dades/transparencia.json';

export { govern, parlament, transparencia };

export type Membre = (typeof govern.consellers)[number];
export type Transparencia = (typeof transparencia.persones)[number];

/** «Òscar Ordeig i Molist» → «oscar-ordeig-i-molist», per a l'adreça de la fitxa. */
export const slug = (nom: string) =>
  nom
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const membres: Membre[] = [govern.president, ...govern.consellers];

export function transparenciaDe(membre: Membre): Transparencia {
  const trobades = transparencia.persones.filter((p) => p.nom_oficial === membre.nom_oficial);
  if (trobades.length !== 1)
    throw new Error(`${membre.nom} té ${trobades.length} entrades a transparencia.json, no una.`);
  return trobades[0]!;
}

const dataLlarga = new Intl.DateTimeFormat('ca', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dataCurta = new Intl.DateTimeFormat('ca', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** «2026-11-22» → «22 de novembre de 2026». */
export const dia = (iso: string) => dataLlarga.format(new Date(iso));
export const diaCurt = (iso: string) => dataCurta.format(new Date(iso));

/** L'import exacte, amb cèntims, com el publica la font. */
export const euros = (n: number) =>
  new Intl.NumberFormat('ca', { style: 'currency', currency: 'EUR' }).format(n);

/** Una suma, sense cèntims. */
export const eurosRodons = (n: number) =>
  new Intl.NumberFormat('ca', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

export const nombre = (n: number) => new Intl.NumberFormat('ca').format(n);

export type Seient = { x: number; y: number; grup: number };

/**
 * Els escons en semicercle, d'esquerra a dreta per grups i en l'ordre que se li dona. Cada fila té
 * els seients proporcionals al seu radi, perquè quedin a la mateixa distància. No és el plànol de la
 * sala: és una manera de veure quina part del total té cada grup.
 */
export function hemicicle(escons: number[], files = 6): Seient[] {
  const total = escons.reduce((a, b) => a + b, 0);
  const radis = Array.from({ length: files }, (_, i) => 0.45 + (i * 0.55) / (files - 1));
  const suma = radis.reduce((a, b) => a + b, 0);
  const perFila = radis.map((r) => Math.round((total * r) / suma));
  perFila[files - 1]! += total - perFila.reduce((a, b) => a + b, 0);

  const seients = radis.flatMap((r, i) => {
    const n = perFila[i]!;
    return Array.from({ length: n }, (_, j) => ({ r, angle: Math.PI - (j * Math.PI) / (n - 1) }));
  });
  seients.sort((a, b) => b.angle - a.angle || a.r - b.r);

  const limits = escons.map((_, i) => escons.slice(0, i + 1).reduce((a, b) => a + b, 0));
  return seients.map((s, k) => ({
    x: s.r * Math.cos(s.angle),
    y: s.r * Math.sin(s.angle),
    grup: limits.findIndex((l) => k < l),
  }));
}

/** «GP PSC-Units» → «PSC-Units»; «G Mixt» → «Grup Mixt». La sigla sola diu poc de cada grup. */
export const nomCurt = (sigla: string) =>
  sigla === 'G Mixt' ? 'Grup Mixt' : sigla.replace(/^GP /, '');
