// Genera les dades amb el codi d'ara a partir de les còpies de les fonts que ja s'han publicat, sense
// consultar cap font:
//   node src/reprodueix-dades.ts <carpeta publicada> <carpeta nova>
// Surt amb el codi 3 si el codi d'ara demana altres URL que les de les còpies, o si no sap llegir
// alguna còpia (per exemple, perquè la font ha canviat de format i el codi ja llegeix el nou): llavors
// les dades només es poden generar consultant les fonts, amb src/dades.ts.
import { SourceError } from './comun.ts';
import { construirDades } from './construeix.ts';
import { DesquadreError, reprodueix } from './procedencia.ts';

const [origen, desti] = process.argv.slice(2);
if (origen === undefined || desti === undefined) {
  console.error('Ús: node src/reprodueix-dades.ts <carpeta publicada> <carpeta nova>');
  process.exit(1);
}
try {
  await reprodueix(origen, desti, construirDades);
  console.log(`Dades generades a ${desti} a partir de les còpies de ${origen}.`);
} catch (error) {
  if (!(error instanceof DesquadreError || error instanceof SourceError)) throw error;
  console.error(`No es poden generar a partir de les còpies: ${error.message}`);
  process.exitCode = 3;
}
