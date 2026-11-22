// Cada pàgina del web, amb el que en veu qui rep l'enllaç: el títol, la descripció i la imatge.
// La plantilla Pagina.astro i les imatges de /previsualitzacions surten d'aquesta llista, i una
// pàgina que no hi és no es pot construir.
import type { Previsualitzacio } from '../previsualitzacio/pinta.ts';

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
