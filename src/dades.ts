// Regenera govern.json, parlament.json, ajuntaments.json, activitat.json, ajuts.json, pressupost.json i contractes.json des de les fonts oficials, amb la còpia de cada resposta:
//   node src/dades.ts [carpeta]
// La carpeta és dades/ si no se'n diu cap altra. Primer ho llegeix i ho comprova tot; només escriu
// si tot quadra. Si una font falla, surt amb un error i deixa la carpeta com estava, perquè es pugui
// executar sense ningú al davant.
import { fileURLToPath } from 'node:url';
import { SourceError } from './comun.ts';
import { construirDades } from './construeix.ts';
import { genera } from './procedencia.ts';

const carpeta = process.argv[2] ?? fileURLToPath(new URL('../dades', import.meta.url));
// El dia a Catalunya, no en UTC: una execució a les 00.30 ja és l'endemà, i un termini d'ajuts
// que acaba el dia abans ja no és obert.
const avui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
try {
  const {
    'govern.json': govern,
    'parlament.json': parlament,
    'ajuntaments.json': ajuntaments,
    'activitat.json': activitat,
    'ajuts.json': ajuts,
    'pressupost.json': pressupost,
    'contractes.json': contractes,
  } = await genera(carpeta, fetch, avui, construirDades);
  console.log(
    `Govern: ${govern.consellers.length} consellers (dades del ${govern.data_dades}). ` +
      `Parlament: ${parlament.diputats.length} diputats en ${parlament.grups.length} grups. ` +
      `Ajuntaments: ${ajuntaments.municipis.length} municipis i ` +
      `${ajuntaments.municipis.reduce((n, m) => n + m.ple.length, 0)} persones als plens ` +
      `(dades del ${ajuntaments.data_dades}). ` +
      `Activitat: ${activitat.sessions.length} sessions del Ple i ${activitat.normes.normes.length} normes. ` +
      `Ajuts: ${ajuts.convocatories.length} convocatòries amb el termini sense acabar (dades del ${ajuts.data_dades}). ` +
      `Pressupost: ${pressupost.despeses.seccions.length} files d’entitat i secció (${pressupost.despeses.mes} ${pressupost.despeses.exercici}) i ` +
      `${pressupost.ingressos.capitols.length} d’entitat i capítol d’ingressos (${pressupost.ingressos.mes} ${pressupost.ingressos.exercici}). ` +
      `Contractes: ${contractes.files.reduce((n, f) => n + f.inscripcions, 0)} adjudicacions del ${contractes.any} en ${contractes.files.length} files d’organisme i procediment (dades del ${contractes.data_dades}).`,
  );
} catch (error) {
  if (!(error instanceof SourceError)) throw error;
  console.error(`No s'han actualitzat les dades: ${error.message}`);
  process.exitCode = 1;
}
