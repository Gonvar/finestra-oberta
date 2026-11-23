// Els fitxers de la branca `dades` tal com hi són, byte a byte, i comprovats: cadascun ha de tenir
// l'empremta que en diu procedencia.json, o el build falla.
import { createHash } from 'node:crypto';
import { signats, type Procedencia } from '../mcp/dades.ts';

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

for (const { fitxer, sha256 } of signats(procedencia)) {
  const empremta = createHash('sha256').update(contingut(fitxer)).digest('hex');
  if (empremta !== sha256)
    throw new Error(`${fitxer} té l'empremta ${empremta}, i procedencia.json diu ${sha256}.`);
}

/** Cloudflare no serveix fitxers de més de 25 MiB; la CI falla si a dist n'hi ha cap de més de 20. */
const MIDA_MAXIMA = 20 * 1024 * 1024;

/**
 * Els fitxers que es publiquen a /dades/: els que signa procedencia.json, i ell mateix. Els que no hi
 * caben (adjudicataris.json) es descarreguen de la branca `dades`, i el servidor MCP els llegeix en
 * trossos des de /conjunts/.
 */
export const publicats = ['procedencia.json', ...signats(procedencia).map((s) => s.fitxer)].filter(
  (fitxer) => Buffer.byteLength(contingut(fitxer)) <= MIDA_MAXIMA,
);
