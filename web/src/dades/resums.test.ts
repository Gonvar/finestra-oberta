import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nomDelModel } from './resums.ts';

test('el model surt amb el seu nom, no amb l’identificador de l’API', () => {
  assert.equal(nomDelModel('claude-haiku-5-5'), 'Claude Haiku 5.5');
});

test('un model sense nom atura el build', () => {
  assert.throws(() => nomDelModel('un-model-nou'), /un-model-nou/);
});
