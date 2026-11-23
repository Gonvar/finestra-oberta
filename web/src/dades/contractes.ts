// Els contractes públics d'aquest any tal com els desa src/contractes.ts a dades/: quants n'ha
// adjudicat cada organisme i per quin import, per procediment. Les sumes per procediment i per
// àmbit es fan aquí, sobre les files de la font, sense treure'n ni afegir-ne cap.
import { percentatge } from './pressupost.ts';
import contractes from '../../../dades/contractes.json' with { type: 'json' };

export { contractes };

type Fila = (typeof contractes.files)[number];

/**
 * Com es tria l'empresa en cada procediment, amb paraules de tots els dies. El build s'atura si la
 * font en fa servir un que no és aquí, perquè ningú es trobi un nom sense explicar.
 */
export const PROCEDIMENTS: Record<string, string> = {
  Obert: "S'anuncia públicament i qualsevol empresa hi pot presentar una oferta.",
  'Basat en acord marc':
    "L'Administració compra a empreses que s'havien triat abans en una licitació general, l'acord marc.",
  Menor:
    'Contractes petits que es poden donar directament: de menys de 40.000 € en obres i de menys de 15.000 € en serveis i compres, i d’un any com a màxim.',
  'Negociat sense publicitat':
    "L'Administració negocia amb una o poques empreses, sense anunci previ. La llei només ho permet en casos concrets. L'adjudicació sí que es publica.",
  'Específic de sistema dinàmic de contractació':
    "Compres a empreses d'una llista oberta, on qualsevol empresa que compleixi les condicions s'hi pot apuntar.",
  "Contractes d'emergències":
    'Quan cal actuar de seguida per una situació greu, es contracta sense els tràmits habituals.',
  Restringit:
    "S'anuncia públicament i qualsevol empresa pot demanar participar-hi. Només fan oferta les que l'Administració selecciona.",
  'Altres adjudicacions segons instruccions internes aprovades':
    'Empreses i fundacions públiques que contracten amb unes normes pròpies. Aquestes normes es publiquen i han de garantir la publicitat i la competència.',
  'Adjudicacions directes no menors':
    'Contractes donats directament a una empresa que la font no classifica com a menors. La font no en dona més detall.',
  'Licitació amb negociació':
    "S'anuncia, les empreses fan ofertes i després l'Administració en negocia les condicions. La llei només ho permet en casos concrets.",
  'Concurs de projectes': "Un concurs per triar un projecte, com el d'un edifici o d'un espai públic.",
};

export const SENSE_PROCEDIMENT = 'Sense procediment';

// La nota de la font diu que el procediment pot ser null, encara que les dades d'avui no en tinguin cap.
function procediment(fila: { procediment: string | null }): string {
  if (fila.procediment === null) return SENSE_PROCEDIMENT;
  if (!Object.hasOwn(PROCEDIMENTS, fila.procediment))
    throw new Error(`contractes.json té un procediment sense explicar: ${fila.procediment}.`);
  return fila.procediment;
}

type Grup = { nom: string; contractes: number; import: number };

function agrupa(files: Fila[], clau: (f: Fila) => string): Grup[] {
  const grups = new Map<string, Grup>();
  for (const f of files) {
    const nom = clau(f);
    let grup = grups.get(nom);
    if (grup === undefined) {
      grup = { nom, contractes: 0, import: 0 };
      grups.set(nom, grup);
    }
    grup.contractes += f.inscripcions;
    grup.import += f.import;
  }
  return [...grups.values()];
}

/**
 * La mateixa regla per a tots els procediments i àmbits: de més a menys import. Cada grup diu
 * quina part dels contractes i quina part dels diners té.
 */
// Els primers dies de gener la font pot no tenir cap adjudicació de l'any: llavors no hi ha cap grup
// i la pàgina ho diu.
export function resum(files: Fila[]) {
  const total = { contractes: 0, import: 0 };
  for (const f of files) {
    total.contractes += f.inscripcions;
    total.import += f.import;
  }
  const amb = (grups: Grup[]) =>
    grups
      .sort((a, b) => b.import - a.import)
      .map((g) => ({
        ...g,
        partContractes: g.contractes / total.contractes,
        partImport: g.import / total.import,
      }));
  return {
    total,
    procediments: amb(agrupa(files, procediment)),
    ambits: amb(agrupa(files, (f) => f.ambit)),
  };
}

/** Una part petita però no nul·la no s'arrodoneix a zero: «0 %» diria que no n'hi ha cap. */
export const part = (valor: number) =>
  valor > 0 && valor < 0.005 ? 'menys de l’1\u00a0%' : percentatge(valor);
