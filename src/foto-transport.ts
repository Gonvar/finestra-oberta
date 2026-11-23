// Fa una foto del transport públic i posa al dia el resum del dia i el resum general:
//   node src/foto-transport.ts <carpeta>
// A <carpeta>/entrada hi ha d'haver el que ja s'ha publicat d'avui (dies/<dia>.json i resum.json),
// si n'hi ha. Escriu a <carpeta>/sortida el que s'ha de publicar, amb la còpia comprimida de cada
// resposta. Si una font falla, surt amb un error i no escriu res.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SourceError } from './comun.ts';
import {
  actualitzaResum,
  afegeixFoto,
  baixa,
  construeixFoto,
  decodifica,
  empremta,
  FONTS,
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
  const fonts = Object.keys(FONTS) as Font[];
  const bytes = await Promise.all(
    fonts.map((f) => baixa(fetch, FONTS[f], f.startsWith('tmb') ? tmb : {})),
  );
  const cossos = Object.fromEntries(fonts.map((f, i) => [f, bytes[i]])) as Record<Font, Uint8Array>;
  const respostes = Object.fromEntries(fonts.map((f) => [f, decodifica(cossos[f], f)])) as Record<
    Font,
    string
  >;
  const sense = construeixFoto(respostes, consultat);
  const { dia, hora, instant } = sense;
  const prefix = `${dia}/${instant}`;
  const captures: Captura[] = fonts.map((font) => ({
    font,
    url: FONTS[font],
    sha256: empremta(cossos[font]),
    fitxer: `captures/${prefix}-${font}.json.gz`,
  }));
  const foto: Foto = { ...sense, captures };

  const entrada = join(carpeta, 'entrada');
  const diaAnterior = await llegeixSiHiEs<Dia>(join(entrada, 'dies', `${dia}.json`));
  const resumAnterior = await llegeixSiHiEs<Resum>(join(entrada, 'resum.json'));
  const diaNou = afegeixFoto(diaAnterior, foto);
  const resum = actualitzaResum(resumAnterior, diaNou, foto);

  const sortida = join(carpeta, 'sortida');
  for (const c of captures) await escriu(join(sortida, c.fitxer), gzipSync(cossos[c.font]));
  await escriu(join(sortida, 'fotos', `${prefix}.json`), JSON.stringify(foto));
  await escriu(join(sortida, 'dies', `${dia}.json`), JSON.stringify(diaNou));
  await escriu(join(sortida, 'resum.json'), JSON.stringify(resum));
  const linies = Object.values(foto.rodalies.linies);
  console.log(
    `Foto del ${dia} a les ${hora}: ${linies.reduce((n, l) => n + Object.keys(l.retards).length, 0)} trens de Rodalies, ` +
      `${Object.values(foto.fgc.linies).reduce((n, l) => n + Object.keys(l).length, 0)} d'FGC i ` +
      `${foto.tmb.metro.length + foto.tmb.bus.length} avisos de TMB. El dia en porta ${diaNou.fotos.length}.`,
  );
} catch (error) {
  if (!(error instanceof SourceError)) throw error;
  console.error(`No s'ha fet la foto: ${error.message}`);
  process.exitCode = 1;
}
