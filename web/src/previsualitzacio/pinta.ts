// Pinta al build les imatges que es veuen quan algú enganxa un enllaç (WhatsApp, Telegram, X…)
// i les icones del web. Els serveis que llegeixen l'Open Graph no accepten SVG, i per això surten en PNG.
import sharp, { type OverlayOptions } from 'sharp';
import type { Institucio } from '../dades/portada.ts';

// Tokens de DESIGN.md §2.1. Les imatges no poden llegir les variables CSS.
const COLOR = {
  gov: '#1F5BD8',
  par: '#A3192F',
  dad: '#0E7A59',
  ink: '#1D1D1F',
  ink2: '#424245',
  ink3: '#6E6E73',
  bg: '#FFFFFF',
} as const;

const NOM_INSTITUCIO: Record<Institucio, string> = {
  gov: 'Govern',
  par: 'Parlament',
  dad: 'Dades',
};

// La tipografia va dins del repo (tipus/) perquè la imatge surti igual a qualsevol màquina que faci el
// build. astro.config.mjs fa que fontconfig només vegi aquesta carpeta. La coma del final diu a Pango
// que «SemiBold» és part del nom de la família, i no un pes que hauria de buscar dins d'«Inter Display».
const TIPUS = {
  normal: 'Inter Display,',
  gruixut: 'Inter Display SemiBold,',
} as const;

export const AMPLE = 1200;
export const ALT = 630;
const MARGE = 80;
const AMPLE_TEXT = AMPLE - 2 * MARGE;

export type Previsualitzacio = {
  /** El que es llegeix primer: el nom de la persona o el títol de la secció. */
  titol: string;
  /** Una segona línia del títol, en el color de la institució, com a la portada. */
  destacat?: string;
  frase: string;
  institucio?: Institucio;
};

function escapa(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

type Text = {
  /** Cada tros amb el seu color; un tros nou comença sempre en una línia nova. */
  trossos: { text: string; color: string }[];
  tipus: keyof typeof TIPUS;
  mida: number;
  espaiat: number;
  interlineat: number;
  maxLinies: number;
};

function markup(text: string, color: string, espaiat: number) {
  return `<span foreground="${color}" letter_spacing="${espaiat}">${escapa(text)}</span>`;
}

async function renderitza(
  markup: string,
  tipus: keyof typeof TIPUS,
  mida: number,
  interlineat = 0,
) {
  const { data, info } = await sharp({
    text: {
      text: markup,
      font: `${TIPUS[tipus]} ${mida}`,
      dpi: 72,
      rgba: true,
      spacing: interlineat,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { imatge: data, ample: info.width, alt: info.height };
}

// Si fontconfig no troba Inter, Pango no falla: fa servir la font per defecte per a totes dues
// famílies. Llavors el gruixut i el normal fan el mateix ample, i és millor aturar el build.
let tipografiaComprovada: Promise<void> | undefined;
function comprovaTipografia() {
  tipografiaComprovada ??= (async () => {
    const [normal, gruixut] = await Promise.all([
      renderitza('Finestra Oberta', 'normal', 40),
      renderitza('Finestra Oberta', 'gruixut', 40),
    ]);
    if (normal.ample === gruixut.ample) {
      throw new Error(
        'No es troba la tipografia Inter de src/previsualitzacio/tipus. Comprova que FONTCONFIG_FILE hi apunta (astro.config.mjs).',
      );
    }
  })();
  return tipografiaComprovada;
}

// Pango no talla amb punts suspensius ni diu quantes línies ha fet. Per això el text es parteix aquí,
// mesurant cada línia, i si no hi cap en `maxLinies` s'abaixa la mida.
async function pintaText({ trossos, tipus, mida, espaiat, interlineat, maxLinies }: Text) {
  await comprovaTipografia();
  for (let ara = mida; ara >= Math.round(mida * 0.6); ara -= 2) {
    const linies: string[] = [];
    for (const { text, color } of trossos) {
      let linia = '';
      for (const paraula of text.split(' ')) {
        const prova = linia ? `${linia} ${paraula}` : paraula;
        const { ample } = await renderitza(markup(prova, color, espaiat), tipus, ara);
        if (ample <= AMPLE_TEXT || !linia) linia = prova;
        else {
          linies.push(markup(linia, color, espaiat));
          linia = paraula;
        }
      }
      linies.push(markup(linia, color, espaiat));
    }
    if (linies.length <= maxLinies) {
      return renderitza(linies.join('\n'), tipus, ara, Math.round(ara * (interlineat - 1)));
    }
  }
  throw new Error(
    `El text no cap a la imatge de previsualització: ${trossos.map((t) => t.text).join(' / ')}`,
  );
}

/** Els quatre vidres de la finestra (DESIGN.md §3, Navegació), sobre un quadrat de `mida` px. */
function logotip(mida: number, colorQuart: string = COLOR.ink) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${mida}" height="${mida}" viewBox="0 0 20 20">
    <rect x="0" y="0" width="9" height="9" rx="2" fill="${COLOR.gov}"/>
    <rect x="11" y="0" width="9" height="9" rx="2" fill="${COLOR.par}"/>
    <rect x="0" y="11" width="9" height="9" rx="2" fill="${COLOR.dad}"/>
    <rect x="11" y="11" width="9" height="9" rx="2" fill="${colorQuart}"/>
  </svg>`;
}

export async function pintaPrevisualitzacio(p: Previsualitzacio): Promise<Buffer> {
  const capes: OverlayOptions[] = [];

  const marca = await pintaText({
    trossos: [{ text: 'Finestra Oberta', color: COLOR.ink }],
    tipus: 'gruixut',
    mida: 34,
    espaiat: -300,
    interlineat: 1,
    maxLinies: 1,
  });
  capes.push({ input: Buffer.from(logotip(40)), left: MARGE, top: 72 });
  capes.push({ input: marca.imatge, left: MARGE + 56, top: 72 + Math.round((40 - marca.alt) / 2) });

  const peu = await pintaText({
    trossos: [{ text: 'finestraoberta.cat', color: COLOR.ink3 }],
    tipus: 'normal',
    mida: 28,
    espaiat: 0,
    interlineat: 1,
    maxLinies: 1,
  });
  capes.push({ input: peu.imatge, left: MARGE, top: ALT - 72 - peu.alt });

  const blocs: { imatge: Buffer; alt: number; abans: number; esquerra: number }[] = [];

  if (p.institucio) {
    const etiqueta = await pintaText({
      trossos: [{ text: NOM_INSTITUCIO[p.institucio], color: COLOR.ink2 }],
      tipus: 'normal',
      mida: 30,
      espaiat: 0,
      interlineat: 1,
      maxLinies: 1,
    });
    blocs.push({ ...etiqueta, abans: 0, esquerra: MARGE + 26 });
  }

  const titol = await pintaText({
    trossos: [
      { text: p.titol, color: COLOR.ink },
      ...(p.destacat ? [{ text: p.destacat, color: COLOR[p.institucio ?? 'gov'] }] : []),
    ],
    tipus: 'gruixut',
    mida: 76,
    espaiat: -2600,
    interlineat: 1.06,
    maxLinies: 2,
  });
  blocs.push({ ...titol, abans: p.institucio ? 28 : 0, esquerra: MARGE });

  const frase = await pintaText({
    trossos: [{ text: p.frase, color: COLOR.ink2 }],
    tipus: 'normal',
    mida: 32,
    espaiat: -150,
    interlineat: 1.35,
    maxLinies: 2,
  });
  blocs.push({ ...frase, abans: 32, esquerra: MARGE });

  // El bloc central queda centrat entre la marca i el peu.
  const dalt = 72 + 40;
  const baix = ALT - 72 - peu.alt;
  const total = blocs.reduce((suma, b) => suma + b.abans + b.alt, 0);
  let y = Math.round(dalt + (baix - dalt - total) / 2);
  for (const b of blocs) {
    y += b.abans;
    capes.push({ input: b.imatge, left: b.esquerra, top: y });
    y += b.alt;
  }
  if (p.institucio) {
    const etiqueta = blocs[0];
    const top = Math.round(dalt + (baix - dalt - total) / 2) + Math.round((etiqueta.alt - 14) / 2);
    const punt = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="7" fill="${COLOR[p.institucio]}"/></svg>`;
    capes.push({ input: Buffer.from(punt), left: MARGE, top });
  }

  return sharp({ create: { width: AMPLE, height: ALT, channels: 3, background: COLOR.bg } })
    .composite(capes)
    .png()
    .toBuffer();
}

type Icona = {
  mida: number;
  /** Fracció del costat que queda buida a cada banda. */
  marge: number;
  fons?: string;
};

export async function pintaIcona({ mida, marge, fons }: Icona): Promise<Buffer> {
  const interior = Math.round(mida * (1 - 2 * marge));
  const lloc = Math.round((mida - interior) / 2);
  return sharp({
    create: {
      width: mida,
      height: mida,
      channels: 4,
      background: fons ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: Buffer.from(logotip(interior)), left: lloc, top: lloc }])
    .png()
    .toBuffer();
}

/**
 * Un .ico amb un sol PNG a dins. Des de Windows Vista el format admet PNG, i tots els navegadors l'entenen;
 * el fitxer només existeix pels lectors que demanen /favicon.ico sense mirar l'HTML.
 */
export function ico(png: Buffer, mida: number): Buffer {
  const cap = Buffer.alloc(6 + 16);
  cap.writeUInt16LE(0, 0);
  cap.writeUInt16LE(1, 2);
  cap.writeUInt16LE(1, 4);
  cap.writeUInt8(mida % 256, 6);
  cap.writeUInt8(mida % 256, 7);
  cap.writeUInt8(0, 8);
  cap.writeUInt8(0, 9);
  cap.writeUInt16LE(1, 10);
  cap.writeUInt16LE(32, 12);
  cap.writeUInt32LE(png.length, 14);
  cap.writeUInt32LE(cap.length, 18);
  return Buffer.concat([cap, png]);
}
