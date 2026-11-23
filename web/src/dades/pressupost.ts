// El pressupost de la Generalitat tal com el desa src/pressupost.ts a dades/. La web només en mostra
// l'entitat Generalitat (codi 1000): la font diu que les entitats no es poden sumar, perquè les
// transferències d'una a una altra hi serien dues vegades.
import pressupost from '../../../dades/pressupost.json' with { type: 'json' };

export { pressupost };

type Seccio = (typeof pressupost.despeses.seccions)[number];
type Capitol = (typeof pressupost.ingressos.capitols)[number];

export const GENERALITAT = '1000';

/** «10 Octubre» → 10. Un altre format atura el build: les xifres dirien un període que no és el seu. */
export function numeroMes(mes: string): number {
  const coincidencia = /^(\d{1,2}) /.exec(mes);
  const numero = coincidencia === null ? NaN : Number(coincidencia[1]);
  if (!(numero >= 1 && numero <= 12))
    throw new Error(`pressupost.json té un mes que no s'entén: ${mes}.`);
  return numero;
}

/** L'últim dia del mes en ISO, que és fins on arriben els acumulats: «2026-10-31». */
export function finsA(exercici: number, mes: string): string {
  return new Date(Date.UTC(exercici, numeroMes(mes), 0)).toISOString().slice(0, 10);
}

/**
 * Els noms de la font són curts i alguns no diuen a què es dedica la secció. Només s'expliquen
 * aquests; la resta de seccions són departaments i el nom ja ho diu.
 */
export const QUE_ES: Record<string, string> = {
  DT: 'Tornar els préstecs i pagar-ne els interessos.',
  PL: "Diners de l'Estat que la Generalitat fa arribar als ajuntaments i altres ens locals.",
  DD: 'Despeses comunes de més d’un departament.',
  FO: 'Una reserva per a despeses que no es podien preveure.',
};

/** Què vol dir cada capítol d'ingressos, amb paraules de tots els dies. El build s'atura si n'apareix un de nou. */
export const CAPITOLS: Record<string, string> = {
  '1': "Impostos sobre el que es guanya o es té, com la part de l'IRPF que va a la Generalitat.",
  '2': "Impostos sobre el que es compra, com la part de l'IVA que va a la Generalitat.",
  '3': 'Taxes, preus públics, vendes i altres ingressos pels serveis que dona.',
  '4': "Diners que rep d'altres administracions, com l'Estat, i d'altres organismes per a la despesa de cada dia.",
  '5': 'Interessos, lloguers i altres rendes dels béns de la Generalitat.',
  '6': 'La venda de béns, com edificis o terrenys.',
  '7': 'Diners que envien altres administracions per fer inversions.',
  '8': 'Préstecs que la Generalitat havia fet i li tornen, i la venda de participacions.',
  '9': 'Préstecs i deute nou que demana la Generalitat, també per tornar el deute que venç.',
};

export function seccionsGeneralitat(seccions: Seccio[]): Seccio[] {
  const nostres = seccions.filter((s) => s.entitat_codi === GENERALITAT);
  if (nostres.length === 0) throw new Error('pressupost.json no té cap secció de la Generalitat.');
  return nostres;
}

export function capitolsGeneralitat(capitols: Capitol[]): Capitol[] {
  const nostres = capitols.filter((c) => c.entitat_codi === GENERALITAT);
  if (nostres.length === 0)
    throw new Error('pressupost.json no té cap capítol d’ingressos de la Generalitat.');
  for (const c of nostres) {
    if (c.capitol === null)
      throw new Error(
        `pressupost.json té el capítol ${c.capitol_codi} de la Generalitat sense nom.`,
      );
    if (!(c.capitol_codi in CAPITOLS))
      throw new Error(
        `pressupost.json té un capítol d'ingressos sense explicar: ${c.capitol_codi}.`,
      );
  }
  return nostres;
}

const suma = <T>(files: T[], camp: (f: T) => number) =>
  files.reduce((total, f) => total + camp(f), 0);

/**
 * La mateixa regla per a totes les seccions: de més a menys pressupost. Les que no tenen pressupost
 * no hi surten, perquè no es pot dir quina part n'han gastat; són a la taula completa.
 */
export function despesa(seccions: Seccio[]) {
  const total = suma(seccions, (s) => s.pressupost_definitiu);
  const gastat = suma(seccions, (s) => s.obligacions_reconegudes);
  const pagat = suma(seccions, (s) => s.obligacions_pagades);
  const barres = seccions
    .filter((s) => s.pressupost_definitiu > 0)
    .sort((a, b) => b.pressupost_definitiu - a.pressupost_definitiu)
    .map((s) => ({
      codi: s.seccio_codi,
      nom: s.seccio,
      pressupost: s.pressupost_definitiu,
      gastat: s.obligacions_reconegudes,
      partGastada: s.obligacions_reconegudes / s.pressupost_definitiu,
    }));
  return { total, gastat, pagat, partGastada: gastat / total, barres };
}

/** D'on surten els diners: la previsió de tot l'any de cada capítol, de més a menys. */
export function ingressos(capitols: Capitol[]) {
  const total = suma(capitols, (c) => c.previsio_final);
  const reconegut = suma(capitols, (c) => c.drets_reconeguts_nets);
  const cobrat = suma(capitols, (c) => c.recaptacio_neta);
  const barres = capitols
    .filter((c) => c.previsio_final > 0)
    .sort((a, b) => b.previsio_final - a.previsio_final)
    .map((c) => ({
      codi: c.capitol_codi,
      nom: c.capitol,
      previsio: c.previsio_final,
      partIngressada: c.drets_reconeguts_nets / c.previsio_final,
      partDelTotal: c.previsio_final / total,
    }));
  return { total, reconegut, cobrat, barres };
}

/** «64.612 milions d'euros» o «4.169 milions»: el milió és la unitat que s'entén en un pressupost. */
export function milions(euros: number): string {
  const m = euros / 1e6;
  if (m < 1) return 'menys d’un milió';
  return `${new Intl.NumberFormat('ca', { maximumFractionDigits: 0 }).format(m)} ${Math.round(m) === 1 ? 'milió' : 'milions'}`;
}

export const percentatge = (part: number) =>
  new Intl.NumberFormat('ca', { style: 'percent', maximumFractionDigits: 0 }).format(part);
