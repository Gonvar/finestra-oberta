// Què ha decidit el Parlament, tal com ho desa src/activitat.ts a dades/activitat.json.
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

/** Els punts on el Ple decideix una iniciativa, en l'ordre del dia. */
export const decisions = (sessio: Sessio) =>
  sessio.punts.flatMap((p) => (p.resultat === null ? [] : [{ ...p, resultat: resultat(p.resultat) }]));

/**
 * Els primers temes d'una sessió sense cap decisió, sense repetir títols, i quants punts de l'ordre del dia
 * queden fora d'aquests temes.
 */
export function temes(sessio: Sessio, quants: number) {
  const mostrats = [...new Set(sessio.punts.map((p) => p.titol))].slice(0, quants);
  return { mostrats, mes: sessio.punts.filter((p) => !mostrats.includes(p.titol)).length };
}

export const lleis = activitat.normes.normes.filter((n) => n.rang === 'Llei');
export const decretsLlei = activitat.normes.normes.filter((n) => n.rang === 'Decret llei');
