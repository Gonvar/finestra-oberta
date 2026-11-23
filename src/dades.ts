// Regenera govern.json, parlament.json, diputats.json, ajuntaments.json, municipis.json, eleccions-municipals.json, mapa-municipis.json, agenda.json, activitat.json, ajuts.json, pressupost.json i contractes.json des de les fonts oficials, amb la còpia de cada resposta:
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
    'diputats.json': diputats,
    'ajuntaments.json': ajuntaments,
    'municipis.json': municipis,
    'eleccions-municipals.json': eleccions,
    'mapa-municipis.json': mapa,
    'agenda.json': agenda,
    'activitat.json': activitat,
    'ajuts.json': ajuts,
    'pressupost.json': pressupost,
    'contractes.json': contractes,
  } = await genera(carpeta, fetch, avui, construirDades);
  console.log(
    `Govern: ${govern.consellers.length} consellers (dades del ${govern.data_dades}). ` +
      `Parlament: ${parlament.diputats.length} diputats en ${parlament.grups.length} grups, amb ${diputats.diputats.reduce((n, d) => n + d.declaracions.length, 0)} declaracions i ${diputats.diputats.reduce((n, d) => n + d.agenda.actes.length, 0)} actes a les agendes del mes. ` +
      `Ajuntaments: ${ajuntaments.municipis.length} municipis i ` +
      `${ajuntaments.municipis.reduce((n, m) => n + m.ple.length, 0)} persones als plens ` +
      `(dades del ${ajuntaments.data_dades}). ` +
      `Municipis: ${municipis.indicadors.length} indicadors de l'Idescat per a ${municipis.municipis.length} municipis. ` +
      `Eleccions municipals del ${eleccions.any}: ${eleccions.municipis.reduce((n, m) => n + m.candidatures.length, 0)} candidatures en ${eleccions.municipis.length} municipis. ` +
      `Mapa: límits de ${mapa.municipis.length} municipis. ` +
      `Agenda: ${agenda.govern.actes.length} actes del Govern i ${agenda.parlament.actes.length} del Parlament. ` +
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
