import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seccions } from './fonts.ts';
import { pagines } from './pagines.ts';

test('cada secció enllaça una pàgina que existeix', () => {
  const rutes = new Set(pagines.map((p) => p.ruta));
  for (const { ruta } of seccions) assert.ok(rutes.has(ruta), ruta);
});

test('cada font té nom, enllaç i data', () => {
  for (const f of seccions.flatMap((s) => s.fonts)) {
    assert.ok(f.nom, f.que);
    assert.match(f.url, /^https:\/\//, f.que);
    assert.match(f.data.dia, /^\d{4}-\d{2}-\d{2}/, f.que);
  }
});
