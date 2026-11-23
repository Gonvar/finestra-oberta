// Què ha decidit el Parlament, tal com ho desa src/activitat.ts a dades/activitat.json.
import activitat from '../../../dades/activitat.json' with { type: 'json' };

export { activitat };

export type Sessio = (typeof activitat.sessions)[number];
export type Punt = Sessio['punts'][number];
export type Resultat = 'aprovat' | 'convalidat' | 'derogat' | 'rebutjat';
export type Norma = (typeof activitat.normes.normes)[number];

/** Com es diu cada resultat a la web: el verb que fa servir la majoria d'acords del Parlament amb aquest resultat. */
export const VERB: Record<Resultat, string> = {
  aprovat: "S'aprova",
  convalidat: 'Es convalida',
  derogat: 'Es deroga',
  rebutjat: 'Es rebutja',
};

// Un resultat que la web no sap dir atura el build: no es mostra mai una decisió sense nom.
function resultat(valor: string): Resultat {
  if (!Object.hasOwn(VERB, valor)) throw new Error(`activitat.json té un resultat desconegut: ${valor}.`);
  return valor as Resultat;
}

/** Els punts on el Ple decideix una iniciativa, en l'ordre del dia. */
export const decisions = (sessio: Sessio) =>
  sessio.punts.flatMap((p) => (p.resultat === null ? [] : [{ ...p, resultat: resultat(p.resultat) }]));

export const lleis = activitat.normes.normes.filter((n) => n.rang === 'Llei');
export const decretsLlei = activitat.normes.normes.filter((n) => n.rang === 'Decret llei');
