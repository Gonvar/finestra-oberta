import type { APIRoute, GetStaticPaths } from 'astro';
import { nomImatge, pagines, type Pagina } from '../../dades/pagines.ts';
import { pintaPrevisualitzacio } from '../../previsualitzacio/pinta.ts';

export const getStaticPaths = (() =>
  pagines.map((pagina) => ({
    params: { nom: nomImatge(pagina.ruta) },
    props: { pagina },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ pagina: Pagina }> = async ({ props }) =>
  new Response(new Uint8Array(await pintaPrevisualitzacio(props.pagina.previsualitzacio)), {
    headers: { 'Content-Type': 'image/png' },
  });
