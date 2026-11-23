import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enllacWeb, llistesObertes } from './municipis.ts';

// Candidatures sintètiques, amb la forma de dades/eleccions-municipals.json.
const candidatura = (sigles: string, regidors: number) => ({ sigles, vots: 10, percentatge: 10, regidors });

test('amb 5 regidors o menys es vota amb llistes obertes', () => {
  assert.equal(llistesObertes([candidatura('A', 3), candidatura('B', 2)]), true);
  // Si alguna candidatura no omple els seus llocs, el ple pot quedar per sota de 5.
  assert.equal(llistesObertes([candidatura('A', 1)]), true);
});

test('amb 7 regidors o més, les llistes són tancades', () => {
  assert.equal(llistesObertes([candidatura('A', 4), candidatura('B', 3)]), false);
});

test('una web sense esquema surt com a enllaç absolut', () => {
  assert.equal(enllacWeb('www.exemple.cat'), 'https://www.exemple.cat');
  assert.equal(enllacWeb('http://www.exemple.cat'), 'http://www.exemple.cat');
  assert.equal(enllacWeb('https://www.exemple.cat/'), 'https://www.exemple.cat/');
});
