// Cada pàgina del web, amb el que en veu qui rep l'enllaç: el títol, la descripció i la imatge.
// La plantilla Pagina.astro i les imatges de /previsualitzacions surten d'aquesta llista, i una
// pàgina que no hi és no es pot construir.
import type { Previsualitzacio } from '../previsualitzacio/pinta.ts';
import { decretsLlei, lleis } from './activitat.ts';
import { govern, membres, nombre, parlament, slug } from './institucions.ts';
import { municipis } from './municipis.ts';

export type Pagina = {
  /** Comença i acaba amb barra, com les rutes que genera Astro: «/», «/parlament/». */
  ruta: string;
  /** Va al <title> i a l'Open Graph. */
  titol: string;
  descripcio: string;
  previsualitzacio: Previsualitzacio;
};

const ENTRADETA =
  'Les dades obertes de les institucions catalanes, amb la font i la data de cada dada.';

export const pagines: Pagina[] = [
  {
    ruta: '/',
    titol: 'Finestra Oberta',
    descripcio: ENTRADETA,
    previsualitzacio: {
      titol: 'Què decideix el Govern.',
      destacat: 'Ara, a la vista.',
      frase: ENTRADETA,
    },
  },
  {
    ruta: '/parlament/',
    titol: 'Parlament · Finestra Oberta',
    descripcio: 'Els grups, els escons i les persones diputades del Parlament de Catalunya.',
    previsualitzacio: {
      titol: 'Qui seu al Parlament',
      frase: `${parlament.escons} escons en ${parlament.grups.length} grups.`,
      institucio: 'par',
    },
  },
  {
    ruta: '/parlament/decisions/',
    titol: 'Què ha decidit el Parlament · Finestra Oberta',
    descripcio: 'Què s’ha aprovat i què s’ha rebutjat a cada sessió del Ple, i les lleis noves.',
    previsualitzacio: {
      titol: 'Què ha decidit el Parlament',
      frase: `${lleis.length} ${lleis.length === 1 ? 'llei' : 'lleis'} del Parlament i ${decretsLlei.length} ${decretsLlei.length === 1 ? 'decret llei' : 'decrets llei'} del Govern en aquesta legislatura.`,
      institucio: 'par',
    },
  },
  {
    ruta: '/govern/',
    titol: 'Govern · Finestra Oberta',
    descripcio: 'Qui forma el Govern de la Generalitat, què cobra cadascú i què declara.',
    previsualitzacio: {
      titol: 'Qui forma el Govern',
      frase: `El president i ${govern.consellers.length} consellers i conselleres, un per departament.`,
      institucio: 'gov',
    },
  },
  {
    ruta: '/agenda/',
    titol: 'Agenda · Finestra Oberta',
    descripcio: 'Els actes públics del Govern i del Parlament de Catalunya, dia a dia.',
    previsualitzacio: {
      titol: 'Agenda',
      frase: 'Què fan el Govern i el Parlament, dia a dia.',
    },
  },
  {
    ruta: '/municipis/',
    titol: 'Municipis · Finestra Oberta',
    descripcio: 'Qui hi viu, qui governa l’ajuntament i com s’hi va votar, municipi a municipi.',
    previsualitzacio: {
      titol: 'Com és el teu municipi',
      frase: `Els ${nombre(municipis.length)} municipis de Catalunya, amb dades oficials.`,
    },
  },
  ...municipis.map((m) => ({
    ruta: m.ruta,
    titol: `${m.nom} · Finestra Oberta`,
    descripcio: `${m.nom}: qui hi viu, qui governa l’ajuntament i com s’hi va votar.`,
    previsualitzacio: { titol: m.nom, frase: `${m.comarca}, província de ${m.provincia}.` },
  })),
  ...membres.map((m) => ({
    ruta: `/govern/${slug(m.nom)}/`,
    titol: `${m.nom} · Finestra Oberta`,
    descripcio: `${m.carrec}: retribució, activitats, agenda i viatges.`,
    previsualitzacio: { titol: m.nom, frase: m.carrec, institucio: 'gov' as const },
  })),
];

/**
 * Astro dona la ruta codificada (accents en %C3%B3) i, a `astro dev`, tant amb barra final com sense.
 * Totes dues formes són la mateixa pàgina.
 */
export function pagina(rutaDemanada: string): Pagina {
  const ruta = decodeURI(rutaDemanada).replace(/\/?$/, '/');
  const trobada = pagines.find((p) => p.ruta === ruta);
  if (!trobada) throw new Error(`La ruta ${ruta} no és a src/dades/pagines.ts`);
  return trobada;
}

// El nom de la imatge segueix la ruta perquè es pugui trobar a dist/ sense consultar la llista.
export function nomImatge(ruta: string): string {
  return ruta === '/' ? 'portada' : ruta.slice(1, -1);
}
