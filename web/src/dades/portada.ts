// El que mostra la portada. Cada dada porta la font i la data: una dada sense totes dues no es publica.
// Mentre el repo no tingui les dades del Govern i del Parlament, els camps queden buits i la portada
// ho diu, en lloc d'omplir-los amb exemples.

export type Institucio = 'gov' | 'par' | 'dad';

export type Font = { nom: string; url: string };

export type Xifra = { valor: string; que: string; periode: string; font: Font };

export type Bloc = {
  institucio: Institucio;
  titol: string;
  frase: string;
  href?: string;
  xifra?: Xifra;
};

export type Fet = {
  data: string;
  institucio: Institucio;
  /** El nom del tipus, perquè el color no sigui l'únic indicador. */
  tipus: string;
  frase: string;
  qui: string;
  font: Font;
};

export const REPO = 'https://github.com/Gonvar/finestra-oberta';

export const blocs: Bloc[] = [
  { institucio: 'gov', titol: 'Govern', frase: 'Qui forma el Govern i què decideix.' },
  { institucio: 'par', titol: 'Parlament', frase: 'Qui seu a cada escó i de quin grup és.' },
  {
    institucio: 'dad',
    titol: 'Dades',
    frase: "Els conjunts de dades oberts de la Generalitat, l'Idescat i Barcelona.",
    href: `${REPO}/blob/main/docs/dades-obertes.md`,
  },
];

export const cronologia: Fet[] = [];

export const xifra: Xifra | undefined = undefined;

/** Preguntes amb la resposta real, obtinguda dels servidors, a docs/exemples.md. */
export const respostes: { nom: string; href: string }[] = [
  {
    nom: "Quantes dones vivien a Osona l'1 de gener de 2025?",
    href: `${REPO}/blob/main/docs/exemples.md#quantes-dones-vivien-a-osona-l1-de-gener-de-2025`,
  },
  {
    nom: 'Quina comarca va tenir més morts en accidents de trànsit el 2023?',
    href: `${REPO}/blob/main/docs/exemples.md#quina-comarca-va-tenir-més-morts-en-accidents-de-trànsit-el-2023`,
  },
];

export const preguntes = [
  "Quantes dones vivien a Osona l'1 de gener de 2025?",
  'Quina comarca va tenir més morts en accidents de trànsit el 2023?',
  "Com ha variat el PIB de Catalunya l'últim trimestre?",
];
