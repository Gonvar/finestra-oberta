import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nomDelModel, resumDe, resums } from './resums.ts';
import type { Sessio } from './activitat.ts';

test('el model surt amb el seu nom, no amb l’identificador de l’API', () => {
  assert.equal(nomDelModel('claude-haiku-5-5'), 'Claude Haiku 5.5');
});

test('un model sense nom atura el build', () => {
  assert.throws(() => nomDelModel('un-model-nou'), /un-model-nou/);
});

test('el resum d’una sessió ha de ser del mateix dia', () => {
  const [primer] = resums.resums;
  assert.ok(primer, 'resums.json no té cap resum');
  const sessio = (data: string) => ({ numero: primer.sessio, data }) as Sessio;
  assert.equal(resumDe(sessio(primer.data)), primer);
  assert.equal(resumDe(sessio('1900-01-01')), undefined);
});
