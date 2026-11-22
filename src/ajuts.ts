// Els ajuts i les subvencions que encara es poden demanar, del Registre de subvencions i ajuts de
// Catalunya (RAISC), que recull les convocatòries de totes les administracions catalanes. No és un
// servidor MCP: src/dades.ts ho desa a la branca `dades`. Totes les convocatòries tenen els mateixos
// camps: el que la font no dona és null.
import { dia, getJson, metadades, SOCRATA, SourceError, type Fetch } from './comun.ts';

export const CONVOCATORIES = 'khxn-nv6a';
const LIMIT = 50_000;

type Fila = Record<string, unknown>;

function camp(fila: Fila, nom: string): string | null {
  const valor = fila[nom];
  // Socrata omet els camps nuls.
  if (valor === undefined) return null;
  if (typeof valor !== 'string') throw new SourceError(`El camp ${nom} no és text: ${valor}.`);
  return valor;
}

function obligatori(fila: Fila, nom: string) {
  const valor = camp(fila, nom);
  if (valor === null || valor.trim() === '')
    throw new SourceError(`Una convocatòria del RAISC no té ${nom}.`);
  return valor;
}

/**
 * El RAISC escriu les dates de presentació com a text, «19/10/2026». Es passen a «2026-10-19» per
 * poder-les comparar i ordenar; l'original es publica al costat. Una data que no té aquesta forma o
 * que no existeix és un error: no es pot saber si el termini és obert.
 */
export function dataIso(text: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (m === null) throw new SourceError(`Data del RAISC inesperada: ${text}.`);
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const data = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== iso)
    throw new SourceError(`Data del RAISC inesperada: ${text}.`);
  return iso;
}

function euros(text: string | null) {
  if (text === null) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) throw new SourceError(`Import del RAISC inesperat: ${text}.`);
  return Number(text);
}

const consulta = (params: Record<string, string>) =>
  `${SOCRATA}/resource/${CONVOCATORIES}.json?${new URLSearchParams({ ...params, $limit: String(LIMIT) })}`;

export async function construirAjuts(fetchImpl: Fetch, avui: string) {
  const meta = await metadades(fetchImpl, CONVOCATORIES);

  // El final del termini és text, i SoQL no el pot comparar amb una data. Primer es demanen tots els
  // finals de termini diferents, que són pocs, i es tria aquí quins no han passat. Així cada data
  // del conjunt es comprova, també les que no es publiquen.
  const finals = await getJson<Fila[]>(
    fetchImpl,
    consulta({
      $select: 'data_fi_presentaci_sol, count(*) as n',
      $group: 'data_fi_presentaci_sol',
      $order: 'data_fi_presentaci_sol',
    }),
  );
  if (finals.length === LIMIT)
    throw new SourceError('Els finals de termini del RAISC no caben en una pàgina.');
  if (finals.length === 0) throw new SourceError('El RAISC no té cap convocatòria.');
  const vigents = finals
    .map((f) => camp(f, 'data_fi_presentaci_sol'))
    // Una convocatòria sense final de termini no es pot dir que sigui oberta, i es deixa fora.
    .filter((text) => text !== null)
    .filter((text) => dataIso(text) >= avui);

  const files =
    vigents.length === 0
      ? []
      : await getJson<Fila[]>(
          fetchImpl,
          consulta({
            $select: [
              'codi_raisc',
              'codi_bdns',
              't_tol_convocat_ria_catal',
              'entitat_oo_aa_o_departament_1',
              'administraci_',
              'tipus_de_convocat_ria',
              'tipus_d_instument_ajut',
              'finalitat_publica',
              'tipus_de_beneficiaris',
              'import_total_convocat_ria',
              'data_inici_presentaci_sol',
              'data_fi_presentaci_sol',
              'seu_electr_nica',
              'url_catala_bases_reg',
            ].join(', '),
            $where: `data_fi_presentaci_sol in (${vigents.map((d) => `'${d}'`).join(', ')})`,
            $order: 'codi_raisc',
          }),
        );
  if (files.length === LIMIT)
    throw new SourceError('Les convocatòries vigents del RAISC no caben en una pàgina.');

  const vistos = new Set<string>();
  const convocatories = files.map((fila) => {
    const codi = obligatori(fila, 'codi_raisc');
    if (vistos.has(codi)) throw new SourceError(`La convocatòria ${codi} surt dues vegades.`);
    vistos.add(codi);
    const inici = camp(fila, 'data_inici_presentaci_sol');
    const fi = obligatori(fila, 'data_fi_presentaci_sol');
    return {
      codi_raisc: codi,
      codi_bdns: camp(fila, 'codi_bdns'),
      titol: obligatori(fila, 't_tol_convocat_ria_catal'),
      organisme: camp(fila, 'entitat_oo_aa_o_departament_1'),
      administracio: camp(fila, 'administraci_'),
      tipus: camp(fila, 'tipus_de_convocat_ria'),
      instrument: camp(fila, 'tipus_d_instument_ajut'),
      finalitat: camp(fila, 'finalitat_publica'),
      beneficiaris: camp(fila, 'tipus_de_beneficiaris'),
      import_total: euros(camp(fila, 'import_total_convocat_ria')),
      inici: inici === null ? null : dataIso(inici),
      fi: dataIso(fi),
      inici_font: inici,
      fi_font: fi,
      seu_electronica: camp(fila, 'seu_electr_nica'),
      bases_reguladores: camp(fila, 'url_catala_bases_reg'),
    };
  });

  return {
    font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
    url: `${SOCRATA}/d/${CONVOCATORIES}`,
    data_dades: dia(meta),
    nota: 'Les convocatòries del RAISC que el dia de la consulta encara no han acabat el termini de presentació de sol·licituds, de totes les administracions. Les que la font no dona amb final de termini no hi són. Les dates es passen a la forma AAAA-MM-DD; les originals són a inici_font i fi_font. Van ordenades per final de termini i, després, pel codi RAISC. Un camp que la font no dona és null, igual per a totes.',
    convocatories: convocatories.sort(
      (a, b) => a.fi.localeCompare(b.fi) || a.codi_raisc.localeCompare(b.codi_raisc),
    ),
  };
}
