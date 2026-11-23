// Els fitxers de la branca `dades` tal com hi són, byte a byte, i comprovats: cadascun ha de tenir
// l'empremta que en diu procedencia.json, o el build falla.
import { createHash } from 'node:crypto';
import type { Procedencia } from '../mcp/dades.ts';

const fitxers = import.meta.glob<string>('../../../dades/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export function contingut(fitxer: string) {
  const text = fitxers[`../../../dades/${fitxer}`];
  if (text === undefined) throw new Error(`procedencia.json signa ${fitxer}, però no hi és.`);
  return text;
}

export const procedencia = JSON.parse(contingut('procedencia.json')) as Procedencia;

for (const [fitxer, sha256] of Object.entries(procedencia.fitxers)) {
  const empremta = createHash('sha256').update(contingut(fitxer)).digest('hex');
  if (empremta !== sha256)
    throw new Error(`${fitxer} té l'empremta ${empremta}, i procedencia.json diu ${sha256}.`);
}

/** Els fitxers que es publiquen a /dades/: els que signa procedencia.json, i ell mateix. */
export const publicats = ['procedencia.json', ...Object.keys(procedencia.fitxers)];
