// Quantes adjudicacions ha fet cada departament o ens aquest any i per quant, del Registre públic
// de contractes, que recull els de la Generalitat, els ens locals i les universitats. No és un
// servidor MCP: src/dades.ts ho desa a la branca `dades`. Les sumes les fa l'API de la font, i no
// es publica cap contracte un per un: els adjudicataris surten sumats per organisme.
import {
  camp,
  getJson,
  metadades,
  obligatori,
  SOCRATA,
  SourceError,
  type Fetch,
  type Fila,
} from './comun.ts';
import { euros } from './pressupost.ts';

export const REGISTRE = 'hb6v-jcbf';
const LIMIT = 50_000;

// Les liquidacions repeteixen contractes que ja hi són com a adjudicació o com a menor, i les
// pròrrogues i les modificacions no porten l'import del contracte: si se sumessin, un contracte es
// comptaria més d'una vegada.
const SITUACIONS = ['adjudicació', 'menor'];

const consulta = (params: Record<string, string>) =>
  `${SOCRATA}/resource/${REGISTRE}.json?${new URLSearchParams({ ...params, $limit: String(LIMIT) })}`;

function recompte(fila: Fila, nom: string) {
  const valor = obligatori(fila, nom, REGISTRE);
  if (!/^\d+$/.test(valor))
    throw new SourceError(`${nom} de ${REGISTRE} no és un nombre: ${valor}.`);
  return Number(valor);
}

// Els primers dies de l'any és normal que no hi hagi cap adjudicació, o només d'un tipus.
const PRIMERS_DIES = '01-15';

const diaCatala = (data: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(data);

export async function construirContractes(fetchImpl: Fetch) {
  const meta = await metadades(fetchImpl, REGISTRE);
  // El límit és el dia de l'última actualització de la font, no el de la consulta: així el fitxer
  // només canvia quan la font canvia, i a principi d'any l'any és el de les últimes dades. És el
  // dia a Catalunya, com les dates d'adjudicació.
  const fins = diaCatala(new Date(meta.rowsUpdatedAt * 1000));
  const any = fins.slice(0, 4);
  // `<= fins` deixaria fora una adjudicació del mateix dia que portés hora.
  const endema = new Date(`${fins}T00:00:00Z`);
  endema.setUTCDate(endema.getUTCDate() + 1);
  const limit = endema.toISOString().slice(0, 10);
  // Les dates surten d'un nombre i `SITUACIONS` és fix: cap d'aquests valors no pot portar una cometa.
  const situacions = `situaci_contractual in (${SITUACIONS.map((s) => `'${s}'`).join(', ')})`;
  const periode = `data_adjudicacio >= '${any}-01-01' and data_adjudicacio < '${limit}'`;

  // Si la font canviés com escriu una situació, la consulta no en trobaria cap i el fitxer en
  // donaria només una part sense cap error.
  const perSituacio = await getJson<Fila[]>(
    fetchImpl,
    consulta({
      $select: 'situaci_contractual, subjecte_ambit, count(*) as inscripcions',
      $where: periode,
      $group: 'situaci_contractual, subjecte_ambit',
    }),
  );
  if (fins.slice(5) >= PRIMERS_DIES)
    for (const situacio of SITUACIONS)
      if (!perSituacio.some((f) => camp(f, 'situaci_contractual') === situacio))
        throw new SourceError(
          `El registre de contractes no té cap inscripció «${situacio}» el ${any}.`,
        );
  const ambits = [
    ...new Set(
      perSituacio
        .filter((f) => SITUACIONS.includes(obligatori(f, 'situaci_contractual', REGISTRE)))
        .map((f) => obligatori(f, 'subjecte_ambit', REGISTRE)),
    ),
  ];

  // Una sola consulta per a tot l'any passa del temps límit de la font; partida per àmbits, cada
  // grup surt sencer d'una sola fila de la font i el codi no ha de sumar res. Agrupar també pel nom
  // fa que, si un organisme el canvia durant l'any, surti en dues files amb el mateix codi.
  const perAmbit = async (columna: string) => {
    const clau = `subjecte_ambit, id_agrupacio_organisme, agrupacio_organisme, ${columna}`;
    const grups: Fila[] = [];
    const vistes = new Set<string>();
    for (const ambit of ambits) {
      // Els grups d'un àmbit poden passar d'una pàgina. L'ordre per tota la clau fa que les
      // pàgines no es trepitgin.
      const delAmbit: Fila[] = [];
      for (;;) {
        const pagina = await getJson<Fila[]>(
          fetchImpl,
          consulta({
            $select: [
              clau,
              'count(*) as inscripcions',
              'count(import_adjudicacio) as amb_import',
              'sum(import_adjudicacio) as import',
            ].join(', '),
            // SoQL escriu una cometa dins d'un text doblant-la: «l''Administració».
            $where: `${situacions} and ${periode} and subjecte_ambit = '${ambit.replaceAll("'", "''")}'`,
            $group: clau,
            $order: clau,
            $offset: String(delAmbit.length),
          }),
        );
        // Una clau repetida voldria dir que les pàgines es trepitgen, i que n'hi ha una altra que
        // falta; si la font no fes cas de $offset, també atura el bucle.
        for (const f of pagina) {
          const k = JSON.stringify(clau.split(', ').map((c) => f[c]));
          if (vistes.has(k))
            // Sense el nom de l'adjudicatari: pot ser una persona, i els errors van als registres.
            throw new SourceError(
              `El registre de contractes repeteix un grup de l'organisme ${String(f.id_agrupacio_organisme)} (${ambit}) a partir de la fila ${delAmbit.length}.`,
            );
          vistes.add(k);
        }
        delAmbit.push(...pagina);
        if (pagina.length < LIMIT) break;
      }
      grups.push(...delAmbit);
    }
    return grups;
  };
  const grups = await perAmbit('procediment_adjudicacio');
  const grupsAdjudicataris = await perAmbit('adjudicatari');

  // La font té adjudicacions amb una data posterior a la de les dades, o sense data. No es poden
  // posar a cap dia de l'any, i es compten a part perquè no desapareguin sense dir-ho.
  const compta = async (condicio: string) => {
    const [fila] = await getJson<Fila[]>(
      fetchImpl,
      consulta({ $select: 'count(*) as inscripcions', $where: `${situacions} and ${condicio}` }),
    );
    if (fila === undefined) throw new SourceError(`El recompte de ${REGISTRE} és buit.`);
    return recompte(fila, 'inscripcions');
  };
  const posteriors = await compta(`data_adjudicacio >= '${limit}'`);
  const senseData = await compta('data_adjudicacio IS NULL');

  // El camp de l'agrupació va just després de l'organisme, com sempre a contractes.json.
  const grup = <K extends string>(f: Fila, nom: K, columna: string) => {
    const inscripcions = recompte(f, 'inscripcions');
    const organisme = obligatori(f, 'agrupacio_organisme', REGISTRE);
    // sum() se salta els imports que falten: la suma seria d'unes inscripcions i el recompte d'unes altres.
    if (recompte(f, 'amb_import') !== inscripcions)
      throw new SourceError(`Hi ha inscripcions de ${organisme} sense import.`);
    return {
      ambit: obligatori(f, 'subjecte_ambit', REGISTRE),
      organisme_codi: obligatori(f, 'id_agrupacio_organisme', REGISTRE),
      organisme,
      ...({ [nom]: camp(f, columna) } as Record<K, string | null>),
      inscripcions,
      import: euros(f, 'import', REGISTRE),
    };
  };
  const files = grups.map((f) => grup(f, 'procediment', 'procediment_adjudicacio'));
  const adjudicataris = grupsAdjudicataris.map((f) => grup(f, 'adjudicatari', 'adjudicatari'));
  // Les dues agrupacions són de les mateixes inscripcions: si no sumen el mateix, la font ha canviat
  // entre consultes o una de les agrupacions perd files.
  const total = (llista: { inscripcions: number }[]) =>
    llista.reduce((n, f) => n + f.inscripcions, 0);
  if (total(files) !== total(adjudicataris))
    throw new SourceError(
      `El registre de contractes dona ${total(files)} inscripcions per procediment i ${total(adjudicataris)} per adjudicatari.`,
    );
  if (files.length === 0 && fins.slice(5) >= PRIMERS_DIES)
    throw new SourceError(`El registre de contractes no té cap adjudicació el ${any}.`);
  // Una adjudicació sense procediment o sense adjudicatari no és d'un valor que vagi abans dels
  // altres: va al final del seu organisme.
  const ordre =
    <K extends 'procediment' | 'adjudicatari'>(k: K) =>
    (
      a: { ambit: string; organisme_codi: string; organisme: string } & Record<K, string | null>,
      b: { ambit: string; organisme_codi: string; organisme: string } & Record<K, string | null>,
    ) =>
      a.ambit.localeCompare(b.ambit, 'ca') ||
      a.organisme_codi.localeCompare(b.organisme_codi, 'ca') ||
      a.organisme.localeCompare(b.organisme, 'ca') ||
      Number(a[k] === null) - Number(b[k] === null) ||
      (a[k] ?? '').localeCompare(b[k] ?? '', 'ca');
  files.sort(ordre('procediment'));
  adjudicataris.sort(ordre('adjudicatari'));
  const font = `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`;

  const comu = {
    font,
    url: `${SOCRATA}/d/${REGISTRE}`,
    data_dades: fins,
  };
  // Les inscripcions que queden fora per la data són les mateixes per als dos fitxers.
  const fora = {
    any: Number(any),
    adjudicacions_posteriors: posteriors,
    adjudicacions_sense_data: senseData,
  };
  const contractes = {
    ...comu,
    nota: `Les adjudicacions des de l’1 de gener fins al dia de l’última actualització de la font, inscrites al Registre públic de contractes, comptades i sumades per àmbit, departament o ens i procediment d’adjudicació; les sumes les fa l’API de la font. Cada inscripció és un contracte o un lot d’un contracte. Només es compten les inscripcions d’adjudicació i les de contractes menors: les liquidacions que s’han comparat repeteixen el contracte amb el mateix import, i les pròrrogues i les modificacions no porten l’import del contracte. Els imports són els d’adjudicació, en euros, tal com els dona la font, que no diu si porten IVA. Els noms i els àmbits són tal com els escriu la font; si un organisme els canvia durant l’any, surt en una fila per a cada nom. L’ordre és el de l’àmbit, el codi de l’organisme (com a text), el nom i el procediment, i les files sense procediment van al final del seu organisme. Les inscripcions amb una data d’adjudicació posterior a la de les dades, o sense data, no hi són: es compten a adjudicacions_posteriors i adjudicacions_sense_data.`,
    ...fora,
    files,
  };
  const perAdjudicatari = {
    ...comu,
    nota: `Les mateixes adjudicacions que contractes.json, comptades i sumades per àmbit, departament o ens i adjudicatari; les sumes les fa l’API de la font. L’adjudicatari és el nom tal com l’escriu la font, que no en publica el NIF: una mateixa empresa escrita de dues maneres surt en dues files, i dues amb el mateix nom surten en una. En els contractes menors hi pot haver persones físiques; el nom es publica com el publica la font, sense creuar-lo amb cap altra dada. Les inscripcions sense adjudicatari tenen adjudicatari a null i van al final del seu organisme. L’ordre és el de l’àmbit, el codi de l’organisme (com a text), el nom de l’organisme i l’adjudicatari. La resta de criteris (quines inscripcions es compten, imports i dates) són els de contractes.json.`,
    ...fora,
    files: adjudicataris,
  };
  return { 'contractes.json': contractes, 'adjudicataris.json': perAdjudicatari };
}
