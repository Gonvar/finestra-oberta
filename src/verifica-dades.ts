// Comprova que les dades publicades surten, sense cap retoc, de les còpies de les fonts oficials:
//   node src/verifica-dades.ts [carpeta]
// La carpeta és dades/ si no se'n diu cap altra: la branca `dades` del repositori.
import { SourceError } from './comun.ts';
import { construirInstitucions } from './institucions.ts';
import { DesquadreError, verifica } from './procedencia.ts';

const carpeta = process.argv[2] ?? 'dades';
try {
  const { procedencia, fitxers } = await verifica(carpeta, construirInstitucions);
  console.log(
    `${fitxers.join(' i ')} surten de les ${procedencia.captures.length} còpies de les fonts ` +
      `consultades el ${procedencia.data_consulta}, i cada còpia té l'empremta que diu procedencia.json.`,
  );
} catch (error) {
  if (!(error instanceof DesquadreError || error instanceof SourceError)) throw error;
  console.error(`Les dades no quadren: ${error.message}`);
  process.exitCode = 1;
}
