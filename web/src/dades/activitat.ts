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
 * Les sigles de comissió que el Parlament posa al final de l'acord, amb el nom de la llista de comissions de la
 * XV legislatura del web del Parlament (consultada el 23 de novembre de 2026). El build s'atura si en surt una que no hi és, perquè ningú es
 * trobi unes sigles sense explicar.
 */
export const COMISSIONS: Record<string, string> = {
  CAI: "Comissió d'Afers Institucionals",
  CARPA: "Comissió d'Agricultura, Ramaderia, Pesca i Alimentació",
  CC: 'Comissió de Cultura',
  CCMA: "Comissió de Control de l'Actuació de la Corporació Catalana de Mitjans Audiovisuals",
  CCTN: 'Comissió de Consolidació de Textos Normatius',
  CDSI: 'Comissió de Drets Socials i Inclusió',
  CE: "Comissió d'Esports",
  CED: "Comissió de l'Estatut dels Diputats",
  CEF: "Comissió d'Economia i Finances",
  CEFERDO: "Comissió d'Estudi sobre el Feixisme, el Racisme i els Discursos d'Odi",
  CEFP: "Comissió d'Educació i Formació Professional",
  CESMA: "Comissió d'Estudi sobre la Salut Mental i les Addiccions",
  CET: "Comissió d'Empresa i Treball",
  CI: 'Comissió de la Infància',
  CIADGAIA: "Comissió d'Investigació sobre l'Activitat de la Direcció General d'Atenció a la Infància i l'Adolescència",
  CIF: "Comissió d'Igualtat i Feminisme",
  CISP: "Comissió d'Interior i Seguretat Pública",
  CJQD: 'Comissió de Justícia i Qualitat Democràtica',
  CMSR: 'Comissió de Matèries Secretes i Reservades',
  COSDARC: "Comissió de Seguiment del Desplegament de les Actuacions de l'Agenda Rural de Catalunya",
  CP: 'Comissió de Peticions',
  CPJ: 'Comissió de Polítiques de Joventut',
  CPL: 'Comissió de Política Lingüística',
  CR: 'Comissió del Reglament',
  CRU: 'Comissió de Recerca i Universitats',
  CS: 'Comissió de Salut',
  CSC: 'Comissió de la Sindicatura de Comptes',
  CSG: 'Comissió del Síndic de Greuges',
  CSPGG: 'Comissió de Seguiment de Polítiques de la Gent Gran',
  CTE: 'Comissió de Transició Ecològica',
  CTH: 'Comissió de Territori i Habitatge',
  CUEAE: "Comissió d'Unió Europea i Acció Exterior",
};

export function sigles(acords: string[]) {
  const trobades = new Set(
    acords.flatMap((a) => {
      const m = /\. ([A-Z]{2,})$/.exec(a);
      return m === null ? [] : [m[1]];
    }),
  );
  for (const s of trobades)
    if (!Object.hasOwn(COMISSIONS, s)) throw new Error(`Falta explicar les sigles ${s} a COMISSIONS.`);
  return [...trobades].sort();
}

export const lleis = activitat.normes.normes.filter((n) => n.rang === 'Llei');
export const decretsLlei = activitat.normes.normes.filter((n) => n.rang === 'Decret llei');
