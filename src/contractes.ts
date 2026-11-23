// Quantes adjudicacions ha fet cada departament o ens aquest any i per quant, del Registre públic
// de contractes, que recull els de la Generalitat, els ens locals i les universitats. No és un
// servidor MCP: src/dades.ts ho desa a la branca `dades`. Les sumes les fa l'API de la font, i no
// es publica cap contracte ni cap adjudicatari un per un.
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
  // donaria només una part sense cap error. Només es demanen les situacions que es fan servir: sense
  // aquest filtre, la font agrupa tot el registre de l'any i triga més que el temps límit (35 s, el
  // 23/11/2026, contra 3 s amb el filtre).
  const perSituacio = await getJson<Fila[]>(
    fetchImpl,
    consulta({
      $select: 'situaci_contractual, subjecte_ambit, count(*) as inscripcions',
      $where: `${situacions} and ${periode}`,
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
  // grup surt sencer en una sola consulta i el codi no ha de sumar res. Agrupar també pel nom fa
  // que, si un organisme el canvia durant l'any, surti en dues files amb el mateix codi.
  const grups: Fila[] = [];
  for (const ambit of ambits) {
    const pagina = await getJson<Fila[]>(
      fetchImpl,
      consulta({
        $select: [
          'subjecte_ambit',
          'id_agrupacio_organisme',
          'agrupacio_organisme',
          'procediment_adjudicacio',
          'count(*) as inscripcions',
          'count(import_adjudicacio) as amb_import',
          'sum(import_adjudicacio) as import',
        ].join(', '),
        // SoQL escriu una cometa dins d'un text doblant-la: «l''Administració».
        $where: `${situacions} and ${periode} and subjecte_ambit = '${ambit.replaceAll("'", "''")}'`,
        $group:
          'subjecte_ambit, id_agrupacio_organisme, agrupacio_organisme, procediment_adjudicacio',
      }),
    );
    if (pagina.length === LIMIT)
      throw new SourceError(`L'àmbit ${ambit} de ${REGISTRE} no cap en una pàgina.`);
    grups.push(...pagina);
  }

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

  const files = grups.map((f) => {
    const inscripcions = recompte(f, 'inscripcions');
    const organisme = obligatori(f, 'agrupacio_organisme', REGISTRE);
    // sum() se salta els imports que falten: la suma seria d'unes inscripcions i el recompte d'unes altres.
    if (recompte(f, 'amb_import') !== inscripcions)
      throw new SourceError(`Hi ha inscripcions de ${organisme} sense import.`);
    return {
      ambit: obligatori(f, 'subjecte_ambit', REGISTRE),
      organisme_codi: obligatori(f, 'id_agrupacio_organisme', REGISTRE),
      organisme,
      procediment: camp(f, 'procediment_adjudicacio'),
      inscripcions,
      import: euros(f, 'import', REGISTRE),
    };
  });
  if (files.length === 0 && fins.slice(5) >= PRIMERS_DIES)
    throw new SourceError(`El registre de contractes no té cap adjudicació el ${any}.`);
  files.sort(
    (a, b) =>
      a.ambit.localeCompare(b.ambit, 'ca') ||
      a.organisme_codi.localeCompare(b.organisme_codi, 'ca') ||
      a.organisme.localeCompare(b.organisme, 'ca') ||
      // Una adjudicació sense procediment no és d'un procediment que vagi abans dels altres.
      Number(a.procediment === null) - Number(b.procediment === null) ||
      (a.procediment ?? '').localeCompare(b.procediment ?? '', 'ca'),
  );

  return {
    font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
    url: `${SOCRATA}/d/${REGISTRE}`,
    data_dades: fins,
    nota: `Les adjudicacions des de l’1 de gener fins al dia de l’última actualització de la font, inscrites al Registre públic de contractes, comptades i sumades per àmbit, departament o ens i procediment d’adjudicació; les sumes les fa l’API de la font. Cada inscripció és un contracte o un lot d’un contracte. Només es compten les inscripcions d’adjudicació i les de contractes menors: les liquidacions que s’han comparat repeteixen el contracte amb el mateix import, i les pròrrogues i les modificacions no porten l’import del contracte. Els imports són els d’adjudicació, en euros, tal com els dona la font, que no diu si porten IVA. Els noms i els àmbits són tal com els escriu la font; si un organisme els canvia durant l’any, surt en una fila per a cada nom. L’ordre és el de l’àmbit, el codi de l’organisme (com a text), el nom i el procediment, i les files sense procediment van al final del seu organisme. Les inscripcions amb una data d’adjudicació posterior a la de les dades, o sense data, no hi són: es compten a adjudicacions_posteriors i adjudicacions_sense_data.`,
    any: Number(any),
    adjudicacions_posteriors: posteriors,
    adjudicacions_sense_data: senseData,
    files,
  };
}
