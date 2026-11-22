import type { APIRoute } from 'astro';
import { ico, pintaIcona } from '../previsualitzacio/pinta.ts';

export const GET: APIRoute = async () =>
  new Response(new Uint8Array(ico(await pintaIcona({ mida: 32, marge: 0.03 }), 32)), {
    headers: { 'Content-Type': 'image/x-icon' },
  });
