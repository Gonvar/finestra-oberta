import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// El mateix que fa astro.config.mjs abans del build.
process.env.FONTCONFIG_FILE = fileURLToPath(new URL('./tipus/fonts.conf', import.meta.url));
const { ALT, AMPLE, ico, pintaIcona, pintaPrevisualitzacio } = await import('./pinta.ts');

test('la previsualització és un PNG de la mida que diu l’Open Graph', async () => {
  const png = await pintaPrevisualitzacio({
    titol: 'Què decideix el Govern.',
    destacat: 'Ara, a la vista.',
    frase: 'Les dades obertes de les institucions catalanes, amb la font i la data de cada dada.',
  });
  const { format, width, height } = await sharp(png).metadata();
  assert.equal(format, 'png');
  assert.equal(width, AMPLE);
  assert.equal(height, ALT);
});

// Els exemples no fan servir noms ni grups reals (DESIGN.md §4, neutralitat).
const LLARG = 'Nom de prova molt llarg que no cap en una sola línia de la imatge';

test('un títol llarg es parteix en dues línies sense sortir de la imatge', async () => {
  const png = await pintaPrevisualitzacio({
    institucio: 'par',
    titol: LLARG,
    frase: 'Frase de prova.',
  });
  // La columna de píxels just abans del marge dret ha de quedar blanca: cap lletra hi arriba.
  const { data, info } = await sharp(png)
    .extract({ left: AMPLE - 80, top: 0, width: 80, height: ALT })
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.ok(
    data.every((v) => v === 255),
    `hi ha text dins del marge dret (${info.width} px)`,
  );
});

test('una paraula sola més ampla que la imatge fa baixar la mida, o atura el build', async () => {
  const png = await pintaPrevisualitzacio({ titol: 'Interdepartamentalització', frase: 'Frase.' });
  assert.equal((await sharp(png).metadata()).width, AMPLE);
  await assert.rejects(
    pintaPrevisualitzacio({ titol: 'Interdepartamentalitzacions'.repeat(3), frase: 'Frase.' }),
    /no cap a la imatge/,
  );
});

test('un text que no hi cap atura el build', async () => {
  await assert.rejects(
    pintaPrevisualitzacio({ titol: 'paraula '.repeat(60), frase: 'Frase.' }),
    /no cap a la imatge/,
  );
});

test('el favicon.ico porta el PNG amb la capçalera que esperen els navegadors', async () => {
  const png = await pintaIcona({ mida: 32, marge: 0 });
  const fitxer = ico(png, 32);
  assert.equal(fitxer.readUInt16LE(2), 1);
  assert.equal(fitxer.readUInt16LE(4), 1);
  assert.equal(fitxer.readUInt32LE(14), png.length);
  assert.deepEqual(fitxer.subarray(22), png);
});
