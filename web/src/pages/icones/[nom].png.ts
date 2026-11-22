import type { APIRoute, GetStaticPaths } from 'astro';
import { pintaIcona } from '../../previsualitzacio/pinta.ts';

// Les que demana el manifest. La «mascara» deixa el logotip dins de la zona segura (el 80 % central)
// perquè Android la pugui retallar en cercle o en quadrat arrodonit.
const icones = {
  '192': { mida: 192, marge: 0.12, fons: '#FFFFFF' },
  '512': { mida: 512, marge: 0.12, fons: '#FFFFFF' },
  'mascara-512': { mida: 512, marge: 0.25, fons: '#FFFFFF' },
};

export const getStaticPaths = (() =>
  Object.entries(icones).map(([nom, icona]) => ({
    params: { nom },
    props: icona,
  }))) satisfies GetStaticPaths;

export const GET: APIRoute<(typeof icones)[keyof typeof icones]> = async ({ props }) =>
  new Response(new Uint8Array(await pintaIcona(props)), {
    headers: { 'Content-Type': 'image/png' },
  });
