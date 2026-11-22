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
  parlament: { font: string; url: string; data_consulta: string; actes: ActeParlament[] };
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
  lloc?: string;
  enllacos: { text: string; url: string }[];
  desconvocat?: string;
};

const deGovern = (a: ActeGovern): Acte => ({
  institucio: 'gov',
  data: a.data,
  hora: a.hora,
  qui: a.departament,
  titol: a.titol,
  text: a.descripcio,
  ...((a.adreca || a.municipi) && {
    lloc: [a.adreca, a.municipi].filter((x) => x).join(', '),
  }),
  enllacos: [],
});

const deParlament = (a: ActeParlament): Acte => ({
  institucio: 'par',
  data: a.data,
  ...(a.hora && { hora: a.hora }),
  qui: a.categoria,
  titol: a.titol,
  ...(a.detalls.length > 0 && { lloc: a.detalls.join(' · ') }),
  enllacos: a.enllacos,
  ...(a.desconvocat && { desconvocat: a.desconvocat }),
});

/**
 * Dins d'un dia, per hora, i els actes sense hora al final: el Parlament no els en posa perquè
 * comencen en acabar-ne un altre. A la mateixa hora, per ordre alfabètic del títol, que no depèn
 * de la institució ni de qui fa l'acte.
 */
function perHora(a: Acte, b: Acte) {
  if (a.hora !== b.hora) {
    if (a.hora === undefined) return 1;
    if (b.hora === undefined) return -1;
    return a.hora < b.hora ? -1 : 1;
  }
  return a.titol.localeCompare(b.titol, 'ca');
}

export type Dia = { data: string; actes: Acte[] };

function perDies(actes: Acte[], recents: boolean): Dia[] {
  const dies = new Map<string, Acte[]>();
  for (const acte of actes) dies.set(acte.data, [...(dies.get(acte.data) ?? []), acte]);
  return [...dies]
    .sort(([a], [b]) => (a < b === recents ? 1 : -1))
    .map(([data, llista]) => ({ data, actes: llista.sort(perHora) }));
}

/**
 * Els actes que encara han de passar, del més proper al més llunyà, i els que ja han passat, del
 * més recent al més antic. `avui` és el dia de la consulta, no el de la compilació: la web no
 * sap què ha passat després.
 */
export function ordena(agenda: Agenda, avui: string) {
  const actes = [...agenda.govern.actes.map(deGovern), ...agenda.parlament.actes.map(deParlament)];
  return {
    propers: perDies(
      actes.filter((a) => a.data >= avui),
      false,
    ),
    fets: perDies(
      actes.filter((a) => a.data < avui),
      true,
    ),
  };
}
