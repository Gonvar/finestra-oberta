// Quantes adjudicacions ha fet cada departament o ens aquest any i per quant, del Registre públic
// de contractes, que recull els de la Generalitat, els ens locals i les universitats. No és un
// servidor MCP: src/dades.ts ho desa a la branca `dades`. Les sumes les fa l'API de la font, i no
// es publica cap contracte ni cap adjudicatari un per un.
import {
  camp,
  dia,
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

// Les liquidacions, les pròrrogues i les modificacions repeteixen contractes que ja hi són com a
// adjudicació o com a menor: si se sumessin, un contracte es comptaria més d'una vegada.
const SITUACIONS = ['adjudicació', 'menor'];

const consulta = (params: Record<string, string>) =>
  `${SOCRATA}/resource/${REGISTRE}.json?${new URLSearchParams({ ...params, $limit: String(LIMIT) })}`;

function recompte(fila: Fila, nom: string) {
  const valor = obligatori(fila, nom, REGISTRE);
  if (!/^\d+$/.test(valor))
    throw new SourceError(`${nom} de ${REGISTRE} no és un nombre: ${valor}.`);
  return Number(valor);
}

export async function construirContractes(fetchImpl: Fetch) {
  const meta = await metadades(fetchImpl, REGISTRE);
  // El límit és el dia de l'última actualització de la font, no el de la consulta: així el fitxer
  // només canvia quan la font canvia, i a principi d'any l'any és el de les últimes dades.
  const fins = dia(meta);
  const any = fins.slice(0, 4);
  // `fins` surt d'una data i `SITUACIONS` és fix: cap valor no pot portar una cometa.
  const situacions = `situaci_contractual in (${SITUACIONS.map((s) => `'${s}'`).join(', ')})`;

  // Agrupar també pel nom i per l'àmbit fa que, si un organisme els canvia durant l'any, surti en
  // dues files amb el mateix codi, cadascuna amb el nom que dona la font.
  const grups = await getJson<Fila[]>(
    fetchImpl,
    consulta({
      $select: [
        'subjecte_ambit',
        'id_agrupacio_organisme',
        'agrupacio_organisme',
        'procediment_adjudicacio',
        'count(*) as inscripcions',
        'sum(import_adjudicacio) as import',
      ].join(', '),
      $where: `${situacions} and data_adjudicacio >= '${any}-01-01' and data_adjudicacio <= '${fins}'`,
      $group:
        'subjecte_ambit, id_agrupacio_organisme, agrupacio_organisme, procediment_adjudicacio',
    }),
  );
  if (grups.length === LIMIT) throw new SourceError(`El conjunt ${REGISTRE} no cap en una pàgina.`);

  // La font té adjudicacions amb una data posterior a la de les dades. No es poden posar a cap dia
  // d'aquest any, i es compten a part perquè no desapareguin sense dir-ho.
  const [posteriors] = await getJson<Fila[]>(
    fetchImpl,
    consulta({
      $select: 'count(*) as inscripcions',
      $where: `${situacions} and data_adjudicacio > '${fins}'`,
    }),
  );
  if (posteriors === undefined) throw new SourceError(`El recompte de ${REGISTRE} és buit.`);

  const files = grups.map((f) => ({
    ambit: obligatori(f, 'subjecte_ambit', REGISTRE),
    organisme_codi: obligatori(f, 'id_agrupacio_organisme', REGISTRE),
    organisme: obligatori(f, 'agrupacio_organisme', REGISTRE),
    // Unes poques adjudicacions no tenen el procediment: són null.
    procediment: camp(f, 'procediment_adjudicacio'),
    inscripcions: recompte(f, 'inscripcions'),
    import: euros(f, 'import', REGISTRE),
  }));
  files.sort(
    (a, b) =>
      a.ambit.localeCompare(b.ambit, 'ca') ||
      a.organisme_codi.localeCompare(b.organisme_codi, 'ca') ||
      a.organisme.localeCompare(b.organisme, 'ca') ||
      // Les files sense procediment van al final del seu organisme.
      Number(a.procediment === null) - Number(b.procediment === null) ||
      (a.procediment ?? '').localeCompare(b.procediment ?? '', 'ca'),
  );

  return {
    font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
    url: `${SOCRATA}/d/${REGISTRE}`,
    data_dades: fins,
    nota: `Les adjudicacions des de l’1 de gener fins al dia de l’última actualització de la font, inscrites al Registre públic de contractes, comptades i sumades per àmbit, departament o ens i procediment d’adjudicació; les sumes les fa l’API de la font. Cada inscripció és un contracte o un lot d’un contracte. Només es compten les inscripcions d’adjudicació i les de contractes menors: les liquidacions repeteixen el contracte amb el mateix import, i les pròrrogues i les modificacions tenen l’import de la pròrroga o de la modificació. Els imports són els d’adjudicació, en euros, tal com els dona la font, que no diu si porten IVA. Els noms i els àmbits són tal com els escriu la font; si un organisme els canvia durant l’any, surt en una fila per a cada nom. L’ordre és el de l’àmbit, el codi de l’organisme (com a text) i el procediment, i les files sense procediment van al final del seu organisme. Les inscripcions amb una data d’adjudicació posterior a la de les dades no hi són: es compten a adjudicacions_posteriors.`,
    any: Number(any),
    adjudicacions_posteriors: recompte(posteriors, 'inscripcions'),
    files,
  };
}
