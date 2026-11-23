import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = join(import.meta.dirname, '..', '.github', 'codi-de-dades-de-main.sh');

function git(carpeta: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: carpeta, encoding: 'utf8' }).trim();
}

function desa(carpeta: string, fitxer: string, text: string): string {
  mkdirSync(join(carpeta, fitxer, '..'), { recursive: true });
  writeFileSync(join(carpeta, fitxer), text);
  git(carpeta, 'add', '-A');
  git(
    carpeta,
    '-c',
    'user.name=prova',
    '-c',
    'user.email=prova@example.invalid',
    'commit',
    '-qm',
    fitxer,
  );
  return git(carpeta, 'rev-parse', 'HEAD');
}

// Una còpia superficial del commit de l'execució, com la de actions/checkout, i un origin on main ha
// avançat amb un canvi al fitxer donat.
function execucio(fitxerCanviat: string) {
  const origen = mkdtempSync(join(tmpdir(), 'origen-'));
  git(origen, 'init', '-q', '-b', 'main');
  const sha = desa(origen, 'src/dades.ts', '1');
  desa(origen, fitxerCanviat, '2');
  const codi = mkdtempSync(join(tmpdir(), 'codi-'));
  git(codi, 'init', '-q');
  git(codi, 'remote', 'add', 'origin', `file://${origen}`);
  git(codi, 'fetch', '-q', '--depth=1', 'origin', sha);
  git(codi, 'checkout', '-q', sha);
  return spawnSync('bash', [script, codi], {
    env: { ...process.env, GITHUB_SHA: sha },
    encoding: 'utf8',
  });
}

test('publica si main només ha canviat fora del codi de les dades', () => {
  assert.equal(execucio('web/src/pagina.astro').status, 0);
});

test('no publica si main ha canviat el codi de les dades', () => {
  for (const fitxer of [
    'src/dades.ts',
    'fonts/fonts.json',
    'package.json',
    '.github/workflows/dades.yml',
  ]) {
    const sortida = execucio(fitxer);
    assert.equal(sortida.status, 1, fitxer);
    assert.match(sortida.stdout, /El codi de les dades ha canviat/);
  }
});

test('no publica si no pot llegir main', () => {
  const codi = mkdtempSync(join(tmpdir(), 'codi-'));
  git(codi, 'init', '-q');
  git(codi, 'remote', 'add', 'origin', `file://${join(codi, 'no-hi-es')}`);
  const sortida = spawnSync('bash', [script, codi], {
    env: { ...process.env, GITHUB_SHA: '0' },
    encoding: 'utf8',
  });
  assert.equal(sortida.status, 1);
  assert.match(sortida.stdout, /No s'ha pogut llegir main/);
});
