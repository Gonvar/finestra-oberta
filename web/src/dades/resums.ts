// Els resums de les sessions del Ple que escriu un model d'IA (vegeu docs/resums.md i NEUTRALITAT.md §5).
import resums from '../../../dades/resums.json' with { type: 'json' };

export { resums };

export type Resum = (typeof resums.resums)[number];

/**
 * El nom que es mostra de cada model. NEUTRALITAT.md §5 demana dir quin model ha escrit el resum: un model
 * nou atura el build, perquè no surti a la web amb l'identificador de l'API.
 */
const NOMS: Record<string, string> = {
  'claude-haiku-5-5': 'Claude Haiku 5.5',
};

export function nomDelModel(model: string) {
  const nom = NOMS[model];
  if (nom === undefined) throw new Error(`resums.json té un model sense nom a la web: ${model}.`);
  return nom;
}

export const resumDe = (sessio: number) => resums.resums.find((r) => r.sessio === sessio);
