// La plantilla de fonts noves, executada sobre una còpia dels fitxers que toca.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const arrel = new URL('../', import.meta.url);

async function copia() {
  const dir = await mkdtemp(join(tmpdir(), 'nova-font-'));
  for (const cami of ['plantilla', 'src/servidors.ts', 'package.json', 'README.md'])
    await cp(new URL(cami, arrel), join(dir, cami), { recursive: true });
  await mkdir(join(dir, 'docs'));
  const executa = (...args: string[]) =>
    promisify(execFile)(process.execPath, [join(dir, 'plantilla/nova-font.ts'), ...args]);
  const llegeix = (cami: string) => readFile(join(dir, cami), 'utf8');
  return { dir, executa, llegeix };
}

test('prepara la font, la registra i no deixa cap marcador de la plantilla', async () => {
  const { dir, executa, llegeix } = await copia();
  try {
    await executa('aigua', '--organisme', "Agència Catalana de l'Aigua", '--domini', 'gencat.cat');
    const generats = ['src/aigua.ts', 'src/aigua.test.ts', 'docs/aigua.md'];
    for (const fitxer of generats) assert.doesNotMatch(await llegeix(fitxer), /__[A-Z_]+__/);
    const codi = await llegeix('src/aigua.ts');
    assert.match(codi, /export function createAiguaServer/);
    assert.match(codi, /Agència Catalana de l’Aigua/);
    assert.doesNotMatch(codi, /\\'/);
    const registre = await llegeix('src/servidors.ts');
    assert.match(registre, /import \{ createAiguaServer \} from '\.\/aigua\.ts';/);
    assert.match(registre, /nom: 'aigua',[\s\S]*crea: createAiguaServer,\n {2}\},\n\];\n$/);
    const { scripts } = JSON.parse(await llegeix('package.json'));
    assert.equal(scripts.aigua, 'node src/index.ts aigua');
    assert.match(await llegeix('README.md'), /^\| \[`aigua`\]\(docs\/aigua\.md\) \| TODO/m);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('no sobreescriu un script, una font ni cap fitxer, i sense dades no escriu res', async () => {
  const { dir, executa, llegeix } = await copia();
  try {
    const abans = await llegeix('package.json');
    for (const args of [
      ['test', '--organisme', 'Un organisme', '--domini', 'gencat.cat'],
      ['idescat', '--organisme', 'Un organisme', '--domini', 'gencat.cat'],
      ['aigua', '--organisme', 'Un organisme'],
      ['aigua', '--organisme', 'Un organisme', '--domini', 'https://gencat.cat'],
      ['aigua', '--domini', 'gencat.cat'],
      ['Aigua', '--organisme', 'Un organisme', '--domini', 'gencat.cat'],
    ])
      await assert.rejects(executa(...args), (error: { stderr: string }) => error.stderr !== '');
    assert.equal(await llegeix('package.json'), abans);
    assert.deepEqual(await readdir(join(dir, 'src')), ['servidors.ts']);
  } finally {
    await rm(dir, { recursive: true });
  }
});
