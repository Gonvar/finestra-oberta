// La taula de fonts oficials de NEUTRALITAT.md, que fan complir src/fonts.test.ts i src/servidors.test.ts.
import { readFile } from 'node:fs/promises';

/** Els dominis de la taula: les files que comencen amb un domini entre accents greus. */
export function dominisOficials(md: string): string[] {
  return [...md.matchAll(/^\| `([a-z0-9.-]+\.[a-z]+)` +\|/gm)].map((m) => m[1] as string);
}

export const llegeixDominis = async () =>
  dominisOficials(await readFile(new URL('../NEUTRALITAT.md', import.meta.url), 'utf8'));

/** Si l'adreça és del domini o d'un subdomini seu, i no d'un que només s'hi assembla. */
export function esDelDomini(adreca: string, domini: string) {
  const host = new URL(adreca).hostname;
  return host === domini || host.endsWith(`.${domini}`);
}
