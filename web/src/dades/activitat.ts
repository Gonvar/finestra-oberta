import activitat from '../../../dades/activitat.json' with { type: 'json' };

export { activitat };

export type Sessio = (typeof activitat.sessions)[number];
export type Punt = Sessio['punts'][number];
export type Resultat = 'aprovat' | 'convalidat' | 'derogat' | 'rebutjat';
export type Norma = (typeof activitat.normes.normes)[number];

const RESULTATS: readonly string[] = ['aprovat', 'convalidat', 'derogat', 'rebutjat'] satisfies Resultat[];

// Un resultat que la web no coneix atura el build: vol dir que src/activitat.ts ha començat a classificar acords nous.
function resultat(valor: string): Resultat {
  if (!RESULTATS.includes(valor)) throw new Error(`activitat.json té un resultat desconegut: ${valor}.`);
  return valor as Resultat;
}

export const decisions = (sessio: Sessio) =>
  sessio.punts.flatMap((p) => (p.resultat === null ? [] : [{ ...p, resultat: resultat(p.resultat) }]));

// «N punts més» compta punts de l'ordre del dia, no títols: hi ha títols repetits, com les preguntes al president.
export function temes(sessio: Sessio, quants: number) {
  const mostrats = [...new Set(sessio.punts.map((p) => p.titol))].slice(0, quants);
  return { mostrats, mes: sessio.punts.filter((p) => !mostrats.includes(p.titol)).length };
}

/**
 * Algunes sigles de comissió que el Parlament posa al final de l'acord. La web les explica al glossari, i el
 * build s'atura si en surt una que no hi és, perquè ningú es trobi unes sigles sense explicar.
 */
export const COMISSIONS: Record<string, string> = {
  CAI: "Comissió d'Afers Institucionals",
  CARPA: "Comissió d'Agricultura, Ramaderia, Pesca i Alimentació",
  CC: 'Comissió de Cultura',
  CED: "Comissió de l'Estatut dels Diputats",
  CET: "Comissió d'Empresa i Treball",
};

export function sigles(acords: string[]) {
  const trobades = new Set(
    acords.flatMap((a) => {
      const m = /\. ([A-Z]{2,6})$/.exec(a);
      return m === null ? [] : [m[1]];
    }),
  );
  for (const s of trobades)
    if (!Object.hasOwn(COMISSIONS, s)) throw new Error(`Falta explicar les sigles ${s} a COMISSIONS.`);
  return [...trobades].sort();
}

export const lleis = activitat.normes.normes.filter((n) => n.rang === 'Llei');
export const decretsLlei = activitat.normes.normes.filter((n) => n.rang === 'Decret llei');
