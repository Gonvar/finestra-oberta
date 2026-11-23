// Fa complir NEUTRALITAT.md §1: el codi només pot consultar els dominis oficials de la taula.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

/** Els dominis de la taula de NEUTRALITAT.md: les files que comencen amb un domini entre accents greus. */
function dominisOficials(md: string): string[] {
  return [...md.matchAll(/^\| `([a-z0-9.-]+\.[a-z]+)` +\|/gm)].map((m) => m[1] as string);
}

/** Les adreces entre cometes del codi que no són de cap domini oficial, ni d'un subdomini seu. */
function adrecesNoOficials(codi: string, dominis: string[]): string[] {
  const adreces = [...codi.matchAll(/['"`](https?:\/\/[^'"`\s]*)/g)].map((m) => m[1] as string);
  return adreces.filter((adreca) => {
    // Sense URL: una adreça muntada a trossos («'https://' + host») no té el domini a la vista i no s'accepta.
    const host = adreca.replace(/^https?:\/\//, '').split(/[/?#:]/)[0] as string;
    return !dominis.some((d) => host === d || host.endsWith(`.${d}`));
  });
}

test('llegeix els dominis de la taula i no els del text', () => {
  const md = [
    'Es pot consultar `exemple.cat` en un text.',
    '| Domini        | Qui el publica |',
    '| ------------- | -------------- |',
    '| `idescat.cat` | Idescat        |',
    '| `govern.cat`  | Govern         |',
  ].join('\n');
  assert.deepEqual(dominisOficials(md), ['idescat.cat', 'govern.cat']);
});

test("accepta els subdominis i rebutja els dominis que només s'hi assemblen", () => {
  const codi = [
    "const API = 'https://api.idescat.cat/taules/v2';",
    'const B = `https://idescat.cat/x`;',
    "const FALS = 'https://idescat.cat.exemple.com/';",
    "const ALTRE = 'https://falsidescat.cat';",
    "const DIARI = 'http://www.diari.cat/noticia';",
    "const TROSSOS = 'https://' + 'www.boe.es';",
    'const PLANTILLA = `https://${host}/api`;',
    '// Un comentari pot citar https://github.com/algu/projecte sense cometes.',
  ].join('\n');
  assert.deepEqual(adrecesNoOficials(codi, ['idescat.cat']), [
    'https://idescat.cat.exemple.com/',
    'https://falsidescat.cat',
    'http://www.diari.cat/noticia',
    'https://',
    'https://${host}/api',
  ]);
});

/** NEUTRALITAT.md §5: l'API del model que escriu els resums, que no és una font, i l'únic fitxer que la crida. */
const IA = { fitxer: 'resums.ts', adreca: 'https://api.anthropic.com/v1/messages' };

test('el codi de src/ només consulta dominis oficials', async () => {
  const neutralitat = await readFile(new URL('../NEUTRALITAT.md', import.meta.url), 'utf8');
  const dominis = dominisOficials(neutralitat);
  assert.ok(
    neutralitat.includes(`\`${IA.adreca}\``),
    `NEUTRALITAT.md no diu que ${IA.fitxer} crida ${IA.adreca}.`,
  );
  assert.ok(dominis.length > 0, 'NEUTRALITAT.md no té la taula de dominis oficials.');
  const dir = new URL('./', import.meta.url);
  const fitxers = (await readdir(dir, { recursive: true })).filter(
    (f) => /\.(ts|js|mjs)$/.test(f) && !f.endsWith('.test.ts'),
  );
  for (const fitxer of fitxers) {
    const codi = await readFile(new URL(fitxer, dir), 'utf8');
    const permeses = fitxer === IA.fitxer ? [IA.adreca] : [];
    assert.deepEqual(
      adrecesNoOficials(codi, dominis).filter((a) => !permeses.includes(a)),
      [],
      `${fitxer} conté adreces que no són a la taula de fonts oficials de NEUTRALITAT.md.`,
    );
  }
});
