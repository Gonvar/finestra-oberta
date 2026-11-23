// Comprova que les dades publicades surten, sense cap retoc, de les còpies de les fonts oficials:
//   node src/verifica-dades.ts [carpeta]
// La carpeta és dades/ si no se'n diu cap altra: la branca `dades` del repositori.
import { fileURLToPath } from 'node:url';
import { SourceError } from './comun.ts';
import { FONTS } from './construeix.ts';
import { DesquadreError, verifica } from './procedencia.ts';

const carpeta = process.argv[2] ?? fileURLToPath(new URL('../dades', import.meta.url));
try {
  const { procedencia, fitxers } = await verifica(carpeta, FONTS);
  const grups = Object.entries(procedencia.grups);
  console.log(
    `${fitxers.join(' i ')} surten de les ${grups.reduce((n, [, g]) => n + g.captures.length, 0)} còpies de les fonts ` +
      `(${grups.map(([nom, g]) => `${nom}, consultada el ${g.data_consulta}`).join('; ')}), i cada còpia té l'empremta que diu procedencia.json.`,
  );
  for (const [nom, g] of grups)
    if (g.fallada !== null)
      console.log(
        `${nom} no respon des del ${g.fallada.data} (${g.fallada.missatge}): les seves dades són del ${g.data_consulta}.`,
      );
} catch (error) {
  if (!(error instanceof DesquadreError || error instanceof SourceError)) throw error;
  console.error(`Les dades no quadren: ${error.message}`);
  process.exitCode = 1;
}
