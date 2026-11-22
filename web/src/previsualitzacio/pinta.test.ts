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

test('un nom llarg es parteix en dues línies en lloc de sortir de la imatge', async () => {
  const png = await pintaPrevisualitzacio({
    institucio: 'par',
    titol: 'Maria Dolors Montserrat i Culleré de Llorenç i Vilanova de la Barca',
    frase: 'Diputada del Grup Parlamentari Socialistes i Units per Avançar, per Barcelona.',
  });
  assert.equal((await sharp(png).metadata()).width, AMPLE);
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
