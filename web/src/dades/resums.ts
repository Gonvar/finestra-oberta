// Els resums de les sessions del Ple que escriu un model d'IA (vegeu docs/resums.md i NEUTRALITAT.md §5).
import publicats from '../../../dades/resums.json' with { type: 'json' };
import type { Resums } from '../../../src/resums.ts';
import type { Sessio } from './activitat.ts';

export const resums = publicats as Resums;

/**
 * El nom que es mostra del model demanat. NEUTRALITAT.md §5 demana dir quin model ha escrit el resum: un model
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

// La data evita posar un resum vell sobre uns punts nous quan la CI genera activitat.json amb el codi d'una PR.
export const resumDe = (sessio: Sessio) =>
  resums.resums.find((r) => r.sessio === sessio.numero && r.data === sessio.data);
