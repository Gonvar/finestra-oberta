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
