// Quants contractes ha adjudicat cada departament o ens aquest any i per quant, del Registre públic
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

export async function construirContractes(fetchImpl: Fetch, avui: string) {
  const meta = await metadades(fetchImpl, REGISTRE);
  const any = avui.slice(0, 4);
  // `avui` el calcula src/dades.ts i `SITUACIONS` és fix: cap valor no pot portar una cometa.
  const situacions = `situaci_contractual in (${SITUACIONS.map((s) => `'${s}'`).join(', ')})`;

  const grups = await getJson<Fila[]>(
    fetchImpl,
    consulta({
      $select: [
        'subjecte_ambit',
        'id_agrupacio_organisme',
        'agrupacio_organisme',
        'procediment_adjudicacio',
        'count(*) as contractes',
        'sum(import_adjudicacio) as import',
      ].join(', '),
      $where: `${situacions} and data_adjudicacio >= '${any}-01-01' and data_adjudicacio <= '${avui}'`,
      $group:
        'subjecte_ambit, id_agrupacio_organisme, agrupacio_organisme, procediment_adjudicacio',
    }),
  );
  if (grups.length === LIMIT) throw new SourceError(`El conjunt ${REGISTRE} no cap en una pàgina.`);
  if (grups.length === 0)
    throw new SourceError(`El conjunt ${REGISTRE} no té cap fila d'aquest any.`);

  // La font té adjudicacions amb una data posterior al dia de la consulta. No es poden posar a cap
  // dia d'aquest any, i es compten a part perquè no desapareguin sense dir-ho.
  const [posteriors] = await getJson<Fila[]>(
    fetchImpl,
    consulta({
      $select: 'count(*) as contractes',
      $where: `${situacions} and data_adjudicacio > '${avui}'`,
    }),
  );
  if (posteriors === undefined) throw new SourceError(`El recompte de ${REGISTRE} és buit.`);

  const files = grups.map((f) => ({
    ambit: obligatori(f, 'subjecte_ambit', REGISTRE),
    organisme_codi: obligatori(f, 'id_agrupacio_organisme', REGISTRE),
    organisme: obligatori(f, 'agrupacio_organisme', REGISTRE),
    // Unes poques adjudicacions no tenen el procediment: són null.
    procediment: camp(f, 'procediment_adjudicacio'),
    contractes: recompte(f, 'contractes'),
    import: euros(f, 'import', REGISTRE),
  }));
  files.sort(
    (a, b) =>
      a.ambit.localeCompare(b.ambit, 'ca') ||
      a.organisme_codi.localeCompare(b.organisme_codi, 'ca') ||
      (a.procediment ?? '').localeCompare(b.procediment ?? '', 'ca'),
  );
  // Dues files amb el mateix codi i procediment voldrien dir que la font dona dos noms o dos àmbits
  // per a un mateix organisme, i els seus contractes quedarien partits.
  const vistes = new Set<string>();
  for (const f of files) {
    const clau = `${f.organisme_codi}/${f.procediment}`;
    if (vistes.has(clau)) throw new SourceError(`El registre de contractes repeteix ${clau}.`);
    vistes.add(clau);
  }

  return {
    font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
    url: `${SOCRATA}/d/${REGISTRE}`,
    data_dades: dia(meta),
    nota: `Els contractes adjudicats des de l’1 de gener fins al dia de la consulta, inscrits al Registre públic de contractes, sumats per àmbit, departament o ens i procediment d’adjudicació; les sumes les fa l’API de la font. Només es compten les inscripcions d’adjudicació i les de contractes menors: les liquidacions, les pròrrogues i les modificacions són del mateix contracte i el comptarien dues vegades. Cada lot és una inscripció. Els imports són els d’adjudicació, en euros, tal com els dona la font, que no diu si porten IVA. Els noms i els àmbits són tal com els escriu la font, i l’ordre és el de l’àmbit, el codi de l’organisme i el procediment. Les inscripcions amb una data d’adjudicació posterior al dia de la consulta no hi són: es compten a adjudicacions_posteriors.`,
    any: Number(any),
    fins_a: avui,
    adjudicacions_posteriors: recompte(posteriors, 'contractes'),
    files,
  };
}
