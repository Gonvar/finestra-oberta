// L'històric del transport públic que publica el workflow de transport a historic.finestraoberta.cat.
// La pàgina el llegeix al navegador, i no en compilar-se, perquè es fa una foto cada mitja hora i la
// web només es compila un cop al dia. Vegeu docs/transport.md.

export const HISTORIC = 'https://historic.finestraoberta.cat';

export type LiniaRodalies = {
  trens: number;
  amb_retard_de_5_min_o_mes: number;
  cancellats: number;
};
export type LiniaFgc = { trens: number; fora_d_hora: number };
type AvisMetro = { id: number; linies: string[]; estacions: string[]; textos: string[] };
type AvisBus = { id: number; linies: string[]; causa: string; tipus: string; text: string };

export type Dia = {
  dia: string;
  fotos: number;
  primera: string;
  darrera: string;
  rodalies: Record<string, LiniaRodalies & { sense_retard_publicat: number }>;
  fgc: Record<string, LiniaFgc & { sense_dada: number }>;
  tmb: { metro: Record<string, number>; bus: Record<string, number> };
};

export type Resum = {
  actualitzat: string;
  ara: {
    consultat: string;
    rodalies: { dades_de: string; linies: Record<string, LiniaRodalies> };
    fgc: { dades_de: string; linies: Record<string, LiniaFgc> };
    tmb: { metro: AvisMetro[]; bus: AvisBus[] };
  };
  dies: Dia[];
};

/** L'ordre de les línies és el del seu codi (R1, R2, R2N… R11), el mateix per a totes. */
export const ordreLinies = (a: string, b: string) => a.localeCompare(b, 'ca', { numeric: true });

/** Els últims `n` dies amb fotos, del més antic al més recent, per dibuixar-los d'esquerra a dreta. */
export const ultimsDies = (dies: Dia[], n: number) => dies.slice(0, n).reverse();

/**
 * Cada línia amb els trens sumats de tots els dies. Un tren es compta un cop cada dia que circula:
 * un tren que surt cada dia de la setmana compta set vegades.
 */
export function sumaLinies<T extends Record<string, number>>(
  dies: Dia[],
  operador: 'rodalies' | 'fgc',
): [string, T][] {
  const suma = new Map<string, Record<string, number>>();
  for (const d of dies)
    for (const [linia, xifres] of Object.entries(d[operador])) {
      const s = suma.get(linia) ?? {};
      for (const [k, v] of Object.entries(xifres)) s[k] = (s[k] ?? 0) + v;
      suma.set(linia, s);
    }
  return [...suma].sort(([a], [b]) => ordreLinies(a, b)).map(([l, s]) => [l, s as T]);
}

export function totals<T extends Record<string, number>>(linies: [string, T][]) {
  const t: Record<string, number> = {};
  for (const [, x] of linies) for (const [k, v] of Object.entries(x)) t[k] = (t[k] ?? 0) + v;
  return t as T;
}

/** «23 %». Sense trens no hi ha cap part: es diu que no n'hi ha, no un zero. */
export function percentatge(part: number, total: number) {
  if (total === 0) return null;
  return `${Math.round((part / total) * 100)} %`;
}

const hora = new Intl.DateTimeFormat('ca', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const dia = new Intl.DateTimeFormat('ca', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'long',
});
const diaCurt = new Intl.DateTimeFormat('ca', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'numeric',
});

export const horaDe = (iso: string) => hora.format(new Date(iso)).replace(':', '.');
/** Els dies del resum són «AAAA-MM-DD» a Catalunya: es llegeixen a migdia perquè no canviïn de dia. */
export const nomDia = (d: string) => dia.format(new Date(`${d}T12:00:00Z`));
export const nomDiaCurt = (d: string) => diaCurt.format(new Date(`${d}T12:00:00Z`));
export const diaDe = (iso: string) => dia.format(new Date(iso));

/** Per a la frase «el 23 de novembre a les 10.07». */
export const momentDe = (iso: string) => `el ${diaDe(iso)} a les ${horaDe(iso)}`;
