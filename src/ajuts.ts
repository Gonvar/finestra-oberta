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
  if (typeof valor !== 'string')
    throw new SourceError(`El camp ${nom} no és text: ${JSON.stringify(valor)}.`);
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
 * poder-les comparar i ordenar; l'original es publica al costat. El que no és una data que existeixi
 * amb aquesta forma (la font té, per exemple, «-») torna null: no es pot saber quin dia vol dir.
 */
export function dataIso(text: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (m === null) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const data = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

// Prou curt perquè l'URL de cada consulta no passi de 4 kB.
const DATES_PER_CONSULTA = 100;

function numero(text: string, nom: string) {
  if (!/^\d+$/.test(text)) throw new SourceError(`${nom} no és un nombre: ${text}.`);
  return Number(text);
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
  // finals de termini diferents, que són pocs, i es tria aquí quins no han passat.
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
  const vigents: string[] = [];
  // Una convocatòria sense final de termini, o amb un final que no és una data, no es pot dir que
  // sigui oberta, i es deixa fora. El JSON diu quantes n'hi ha i quins valors tenen.
  const noLlegibles: { valor: string | null; convocatories: number }[] = [];
  for (const fila of finals) {
    const text = camp(fila, 'data_fi_presentaci_sol');
    const iso = text === null ? null : dataIso(text);
    if (iso === null)
      noLlegibles.push({
        valor: text,
        convocatories: numero(obligatori(fila, 'n'), 'El recompte'),
      });
    else if (iso >= avui && text !== null) vigents.push(text);
  }
  // El RAISC sempre té convocatòries obertes: si no en surt cap, la font ha canviat la forma de
  // les dates, i publicar una llista buida diria que no se'n pot demanar cap.
  if (vigents.length === 0)
    throw new SourceError('Cap final de termini del RAISC és d’avui o més endavant.');

  const files: Fila[] = [];
  for (let i = 0; i < vigents.length; i += DATES_PER_CONSULTA) {
    const tros = vigents.slice(i, i + DATES_PER_CONSULTA);
    const pagina = await getJson<Fila[]>(
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
        // Els valors són dates comprovades per dataIso: no poden portar cap cometa.
        $where: `data_fi_presentaci_sol in (${tros.map((d) => `'${d}'`).join(', ')})`,
        $order: 'codi_raisc',
      }),
    );
    if (pagina.length === LIMIT)
      throw new SourceError('Les convocatòries vigents del RAISC no caben en una pàgina.');
    files.push(...pagina);
  }

  const vistos = new Set<string>();
  const convocatories = files.map((fila) => {
    const codi = obligatori(fila, 'codi_raisc');
    if (vistos.has(codi)) throw new SourceError(`La convocatòria ${codi} surt dues vegades.`);
    vistos.add(codi);
    const inici = camp(fila, 'data_inici_presentaci_sol');
    const fi = obligatori(fila, 'data_fi_presentaci_sol');
    const fiIso = dataIso(fi);
    if (fiIso === null) throw new SourceError(`La convocatòria ${codi} no té un final de termini.`);
    return {
      codi_raisc: codi,
      codi_bdns: camp(fila, 'codi_bdns'),
      titol: camp(fila, 't_tol_convocat_ria_catal'),
      organisme: camp(fila, 'entitat_oo_aa_o_departament_1'),
      administracio: camp(fila, 'administraci_'),
      tipus: camp(fila, 'tipus_de_convocat_ria'),
      instrument: camp(fila, 'tipus_d_instument_ajut'),
      finalitat: camp(fila, 'finalitat_publica'),
      beneficiaris: camp(fila, 'tipus_de_beneficiaris'),
      import_total: euros(camp(fila, 'import_total_convocat_ria')),
      inici: inici === null ? null : dataIso(inici),
      fi: fiIso,
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
    nota: 'Les convocatòries del RAISC que el dia de la consulta encara no han acabat el termini de presentació de sol·licituds, de totes les administracions. Les que la font no dona amb un final de termini que sigui una data no hi són: finals_no_llegibles en diu els valors i quantes convocatòries en tenen cadascun. Les dates es passen a la forma AAAA-MM-DD; les originals són a inici_font i fi_font, i si la font n’escriu una que no és una data, inici és null. Van ordenades per final de termini i, després, pel codi RAISC. Un camp que la font no dona és null, igual per a totes.',
    finals_no_llegibles: noLlegibles,
    convocatories: convocatories.sort(
      (a, b) => a.fi.localeCompare(b.fi, 'ca') || a.codi_raisc.localeCompare(b.codi_raisc, 'ca'),
    ),
  };
}
