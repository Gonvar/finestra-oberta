// Fa una foto del transport públic i posa al dia el resum del dia i el resum general:
//   node src/foto-transport.ts <carpeta>
// A <carpeta>/entrada hi ha d'haver el que ja s'ha publicat d'avui (dies/<dia>.json i resum.json),
// si n'hi ha. Escriu a <carpeta>/sortida el que s'ha de publicar, amb la còpia comprimida de cada
// resposta. Si una font falla, surt amb un error i no escriu res, tret que sigui FGC que no respon:
// llavors la foto es fa sense FGC i ho diu.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { FontNoRespon, SourceError } from './comun.ts';
import {
  actualitzaResum,
  afegeixFoto,
  baixa,
  construeixFoto,
  decodifica,
  empremta,
  FONTS,
  FONTS_FGC,
  type Captura,
  type Dia,
  type Font,
  type Foto,
  type Resum,
} from './historic.ts';
import { clauTmb } from './operadors.ts';

const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Indica la carpeta: node src/foto-transport.ts <carpeta>');
  process.exit(1);
}

/** Un fitxer que pot no existir encara: el primer dia, o la primera foto del dia. */
async function llegeixSiHiEs<T>(fitxer: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(fitxer, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

const escriu = async (fitxer: string, contingut: string | Uint8Array) => {
  await mkdir(join(fitxer, '..'), { recursive: true });
  await writeFile(fitxer, contingut);
};

try {
  const consultat = new Date().toISOString();
  const tmb = clauTmb();
  const totes = Object.keys(FONTS) as Font[];
  const baixaFont = (f: Font) => baixa(fetch, FONTS[f], f.startsWith('tmb') ? tmb : {});
  const esFgc = (f: Font) => (FONTS_FGC as readonly Font[]).includes(f);
  const [altres, deFgc] = await Promise.all([
    Promise.all(totes.filter((f) => !esFgc(f)).map(async (f) => [f, await baixaFont(f)] as const)),
    // Només es perdona que FGC no respongui o digui que ara no pot (429 o 5xx). Un altre estat, com
    // un 404 per una adreça canviada, o una resposta que no s'entén, continua aturant la foto.
    Promise.all(FONTS_FGC.map(async (f) => [f, await baixaFont(f)] as const)).catch(
      (error: unknown) => {
        if (!(error instanceof FontNoRespon)) throw error;
        return error.message;
      },
    ),
  ]);
  const fgcNoHaRespost = typeof deFgc === 'string' ? deFgc : null;
  if (fgcNoHaRespost !== null) console.log(`::warning::La foto es fa sense FGC: ${fgcNoHaRespost}`);
  const cossos = Object.fromEntries([
    ...altres,
    ...(typeof deFgc === 'string' ? [] : deFgc),
  ]) as Partial<Record<Font, Uint8Array>>;
  const fonts = totes.filter((f) => cossos[f] !== undefined);
  const cos = (f: Font) => cossos[f] as Uint8Array;
  const respostes = Object.fromEntries(fonts.map((f) => [f, decodifica(cos(f), f)]));
  const sense = construeixFoto(respostes, consultat, fgcNoHaRespost);
  const { dia, hora, instant } = sense;
  const prefix = `${dia}/${instant}`;
  const captures: Captura[] = fonts.map((font) => ({
    font,
    url: FONTS[font],
    sha256: empremta(cos(font)),
    fitxer: `captures/${prefix}-${font}.json.gz`,
  }));
  const foto: Foto = { ...sense, captures };

  const entrada = join(carpeta, 'entrada');
  const diaAnterior = await llegeixSiHiEs<Dia>(join(entrada, 'dies', `${dia}.json`));
  const resumAnterior = await llegeixSiHiEs<Resum>(join(entrada, 'resum.json'));
  const diaNou = afegeixFoto(diaAnterior, foto);
  const resum = actualitzaResum(resumAnterior, diaNou, foto);

  const sortida = join(carpeta, 'sortida');
  for (const c of captures) await escriu(join(sortida, c.fitxer), gzipSync(cos(c.font)));
  await escriu(join(sortida, 'fotos', `${prefix}.json`), JSON.stringify(foto));
  await escriu(join(sortida, 'dies', `${dia}.json`), JSON.stringify(diaNou));
  await escriu(join(sortida, 'resum.json'), JSON.stringify(resum));
  const linies = Object.values(foto.rodalies.linies);
  console.log(
    `Foto del ${dia} a les ${hora}: ${linies.reduce((n, l) => n + Object.keys(l.retards).length, 0)} trens de Rodalies, ` +
      ('linies' in foto.fgc
        ? `${Object.values(foto.fgc.linies).reduce((n, l) => n + Object.keys(l).length, 0)} d'FGC i `
        : "cap d'FGC, que no ha respost, i ") +
      `${foto.tmb.metro.length + foto.tmb.bus.length} avisos de TMB. El dia en porta ${diaNou.fotos.length}.`,
  );
} catch (error) {
  if (!(error instanceof SourceError)) throw error;
  console.error(`No s'ha fet la foto: ${error.message}`);
  process.exitCode = 1;
}
