import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nomImatge, pagina, pagines } from './pagines.ts';

test('una ruta que no és a la llista atura el build', () => {
  assert.throws(() => pagina('/no-existeix/'), /no és a src\/dades\/pagines.ts/);
});

test('la ruta es troba amb barra final o sense', () => {
  assert.equal(pagina('/').ruta, '/');
  assert.equal(pagina('').ruta, '/');
});

test('totes les rutes comencen i acaben amb barra', () => {
  for (const { ruta } of pagines) assert.match(ruta, /^\/(.+\/)?$/);
});

test('cada pàgina té una imatge pròpia', () => {
  const noms = pagines.map((p) => nomImatge(p.ruta));
  assert.equal(new Set(noms).size, noms.length);
  assert.equal(nomImatge('/'), 'portada');
  assert.equal(nomImatge('/parlament/salvador-illa/'), 'parlament/salvador-illa');
});
