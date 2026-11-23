// Els contractes públics d'aquest any tal com els desa src/contractes.ts a dades/: quants n'ha
// adjudicat cada organisme i per quin import, per procediment. Les sumes per procediment i per
// àmbit es fan aquí, sobre les files de la font, sense treure'n ni afegir-ne cap.
import contractes from '../../../dades/contractes.json' with { type: 'json' };

export { contractes };

type Fila = (typeof contractes.files)[number];

/**
 * Com es tria l'empresa en cada procediment, amb paraules de tots els dies. El build s'atura si la
 * font en fa servir un que no és aquí, perquè ningú es trobi un nom sense explicar.
 */
export const PROCEDIMENTS: Record<string, string> = {
  Obert: "Qualsevol empresa hi pot presentar una oferta, i s'anuncia públicament.",
  'Basat en acord marc':
    "L'Administració compra a empreses que ja havia triat abans en un concurs general, l'acord marc.",
  Menor:
    'Contractes petits que es poden donar sense concurs. La llei hi posa un import màxim i un temps màxim.',
  'Negociat sense publicitat':
    "L'Administració negocia amb una o poques empreses sense anunciar-ho. La llei només ho permet en casos concrets.",
  'Específic de sistema dinàmic de contractació':
    "Compres a empreses d'una llista oberta, on qualsevol empresa que compleixi les condicions s'hi pot apuntar.",
  "Contractes d'emergències":
    'Quan cal actuar de seguida per una situació greu, es contracta sense els tràmits habituals.',
  Restringit: "Només hi poden fer ofertes les empreses que l'Administració convida després d'una selecció.",
  'Altres adjudicacions segons instruccions internes aprovades':
    'Organismes que segueixen les seves pròpies normes de contractació, aprovades abans.',
  'Adjudicacions directes no menors': "Contractes donats directament a una empresa que no són contractes menors.",
  'Licitació amb negociació':
    "Les empreses fan ofertes i després l'Administració en negocia les condicions amb elles.",
  'Concurs de projectes': "Un concurs per triar un projecte, com el d'un edifici o d'un espai públic.",
};

export const SENSE_PROCEDIMENT = 'Sense procediment';

// La nota de la font diu que el procediment pot ser null, encara que les dades d'avui no en tinguin cap.
function procediment(fila: { procediment: string | null }): string {
  if (fila.procediment === null) return SENSE_PROCEDIMENT;
  if (!(fila.procediment in PROCEDIMENTS))
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
export function resum(files: Fila[]) {
  if (files.length === 0) throw new Error('contractes.json no té cap fila.');
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
