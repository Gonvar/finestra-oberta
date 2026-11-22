// L'agenda del Govern i del Parlament, tal com la desa src/agenda.ts a dades/agenda.json, en una
// sola llista per dies. Aquest mòdul no llegeix el fitxer, perquè les proves hi puguin passar dades
// sintètiques: el llegeix la pàgina.

export type ActeGovern = {
  id: string;
  data: string;
  hora: string;
  titol: string;
  descripcio: string;
  adreca?: string;
  municipi?: string;
  autoritat: string;
  departament: string;
};

export type ActeParlament = {
  data: string;
  hora?: string;
  titol: string;
  detalls: string[];
  enllacos: { text: string; url: string }[];
  publicat?: string;
  desconvocat?: string;
  categoria: string;
};

export type Agenda = {
  govern: { font: string; url: string; data_dades: string; actes: ActeGovern[] };
  parlament: {
    font: string;
    url: string;
    data_consulta: string;
    des_de: string;
    actes: ActeParlament[];
  };
};

/** Un acte de qualsevol de les dues institucions, amb els mateixos camps per a totes dues. */
export type Acte = {
  institucio: 'gov' | 'par';
  data: string;
  hora?: string;
  /** Qui l'organitza: el departament o la categoria, tal com la dona la font. */
  qui: string;
  titol: string;
  text?: string;
  /** El lloc, o els paràgrafs de l'acte del Parlament: la sessió, la sala, «En acabar…». */
  detalls: string[];
  enllacos: { text: string; url: string }[];
  desconvocat?: string;
};

type Ordenable = { acte: Acte; clau: string; posicio: number };

const deGovern = (a: ActeGovern, posicio: number): Ordenable => ({
  acte: {
    institucio: 'gov',
    data: a.data,
    hora: a.hora,
    qui: a.departament,
    titol: a.titol,
    text: a.descripcio,
    detalls: [[a.adreca, a.municipi].filter((x) => x).join(', ')].filter((x) => x),
    enllacos: [],
  },
  clau: a.hora,
  posicio,
});

/**
 * Un acte del Parlament sense hora comença en acabar-ne un altre: va just després de l'acte que el
 * precedeix al web, amb la mateixa hora per ordenar. El primer del dia sense hora va al principi.
 */
function deParlament(actes: ActeParlament[]): Ordenable[] {
  let anterior = { data: '', clau: '' };
  return actes.map((a, posicio) => {
    const clau = a.hora ?? (anterior.data === a.data ? anterior.clau : '');
    anterior = { data: a.data, clau };
    return {
      acte: {
        institucio: 'par',
        data: a.data,
        ...(a.hora && { hora: a.hora }),
        qui: a.categoria,
        titol: a.titol,
        detalls: a.detalls,
        enllacos: a.enllacos,
        ...(a.desconvocat && { desconvocat: a.desconvocat }),
      },
      clau,
      posicio,
    };
  });
}

/**
 * Dins d'un dia, per hora. A la mateixa hora, primer el Govern i després el Parlament, per ordre
 * alfabètic, perquè un acte del Parlament que comença en acabar-ne un altre no se'n separi. Dins de
 * cada institució, l'ordre de la seva font.
 */
function perHora(a: Ordenable, b: Ordenable) {
  if (a.clau !== b.clau) return a.clau < b.clau ? -1 : 1;
  if (a.acte.institucio !== b.acte.institucio) return a.acte.institucio === 'gov' ? -1 : 1;
  return a.posicio - b.posicio;
}

export type Dia = { data: string; actes: Acte[] };

function perDies(actes: Ordenable[], recents: boolean): Dia[] {
  const dies = new Map<string, Ordenable[]>();
  for (const o of actes) dies.set(o.acte.data, [...(dies.get(o.acte.data) ?? []), o]);
  return [...dies]
    .sort(([a], [b]) => (a < b === recents ? 1 : -1))
    .map(([data, llista]) => ({ data, actes: llista.sort(perHora).map((o) => o.acte) }));
}

/**
 * Els actes que encara han de passar, del més proper al més llunyà, i els que ja han passat, del
 * més recent al més antic. `avui` és el dia de la consulta, no el de la compilació: la web no
 * sap què ha passat després. El Govern només publica actes fets, i els d'avui ja ho són.
 */
export function ordena(agenda: Agenda, avui: string) {
  const govern = agenda.govern.actes.map(deGovern);
  const parlament = deParlament(agenda.parlament.actes);
  const previst = (o: Ordenable) =>
    o.acte.institucio === 'par' ? o.acte.data >= avui : o.acte.data > avui;
  const actes = [...govern, ...parlament];
  return {
    propers: perDies(actes.filter(previst), false),
    fets: perDies(
      actes.filter((o) => !previst(o)),
      true,
    ),
  };
}
