import type { APIRoute } from 'astro';
import { pintaIcona } from '../previsualitzacio/pinta.ts';

// iOS no fa servir la transparència: sense fons blanc, hi posaria negre.
export const GET: APIRoute = async () =>
  new Response(new Uint8Array(await pintaIcona({ mida: 180, marge: 0.2, fons: '#FFFFFF' })), {
    headers: { 'Content-Type': 'image/png' },
  });
