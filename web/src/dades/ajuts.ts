// Les convocatòries d'ajuts i subvencions del RAISC que encara no han tancat el termini, tal com les
// desa src/ajuts.ts a dades/. Els recomptes per finalitat, administració i a qui van es fan aquí,
// sobre totes les convocatòries de la font, sense treure'n ni afegir-ne cap.
import ajuts from '../../../dades/ajuts.json' with { type: 'json' };

export { ajuts };

type Convocatoria = {
  inici: string | null;
  administracio: string | null;
  finalitat: string | null;
  beneficiaris: string | null;
  tipus: string | null;
  import_total: number | null;
};

/**
 * Les categories de beneficiaris del RAISC, amb paraules de tots els dies. El build s'atura si la
 * font en fa servir una que no és aquí, perquè ningú es trobi un nom sense explicar.
 */
export const BENEFICIARIS: Record<string, string> = {
  'Persones físiques que no desenvolupen activitat econòmica': 'Persones',
  'Persones jurídiques que no desenvolupen activitat econòmica':
    'Entitats sense activitat econòmica, com les associacions',
  'PYME i Pers. físiques que desenvolupen activitat econòmica':
    'Petites i mitjanes empreses i autònoms',
  'Gran empresa': 'Grans empreses',
};

/** Què vol dir cada tipus de convocatòria. El build s'atura si n'apareix un de nou. */
export const TIPUS: Record<string, string> = {
  'Subvenció amb concurrència': 'Hi pot optar qualsevol que compleixi les condicions de les bases.',
  'Subvenció sense concurrència (directa, nominativa)':
    'Es dona directament, sense comparar sol·licituds. La llei ho permet quan el pressupost ja diu a qui va o en casos concrets.',
};

export const SENSE_DADA = 'La font no ho diu';

function categoria(valor: string | null, explicacions: Record<string, string>, nom: string) {
  if (valor === null) return SENSE_DADA;
  if (!Object.hasOwn(explicacions, valor))
    throw new Error(`ajuts.json té ${nom} sense explicar: ${valor}.`);
  return valor;
}

type Grup = { nom: string; convocatories: number; part: number };

function compta(noms: string[][], total: number): Grup[] {
  const grups = new Map<string, number>();
  for (const llista of noms) for (const nom of llista) grups.set(nom, (grups.get(nom) ?? 0) + 1);
  return [...grups]
    .map(([nom, convocatories]) => ({ nom, convocatories, part: convocatories / total }))
    .sort((a, b) => b.convocatories - a.convocatories || a.nom.localeCompare(b.nom, 'ca'));
}

/**
 * La mateixa regla per a totes les llistes: de més a menys convocatòries i, si n'hi ha les mateixes,
 * per ordre alfabètic. Una convocatòria pot anar a més d'un tipus de beneficiari, i llavors compta a
 * cadascun: les parts de «per a qui» no sumen el 100 %.
 */
export function resum(convocatories: Convocatoria[], avui: string) {
  const total = convocatories.length;
  const imports = convocatories.flatMap((c) => (c.import_total === null ? [] : [c.import_total]));
  return {
    total,
    import: imports.reduce((suma, i) => suma + i, 0),
    senseImport: total - imports.length,
    perObrir: convocatories.filter((c) => c.inici !== null && c.inici > avui).length,
    tipus: compta(
      convocatories.map((c) => [categoria(c.tipus, TIPUS, 'un tipus de convocatòria')]),
      total,
    ),
    finalitats: compta(
      convocatories.map((c) => [c.finalitat ?? SENSE_DADA]),
      total,
    ),
    administracions: compta(
      convocatories.map((c) => [c.administracio ?? SENSE_DADA]),
      total,
    ),
    beneficiaris: compta(
      convocatories.map((c) =>
        c.beneficiaris === null
          ? [SENSE_DADA]
          : c.beneficiaris.split('; ').map((b) => categoria(b, BENEFICIARIS, 'un beneficiari')),
      ),
      total,
    ),
  };
}

/** «Local / Municipi» → «Municipi»: la font hi posa davant el nivell, que ja diu el títol. */
export const administracio = (nom: string) => nom.replace(/^Local \/ /, '');

export const convocatoriesEnText = (n: number, nombre: (n: number) => string) =>
  `${nombre(n)} ${n === 1 ? 'convocatòria' : 'convocatòries'}`;
