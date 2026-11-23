// Els processos de selecció de personal de les administracions catalanes que tenen el termini de
// presentació obert, del CIDO (Cercador d'informació i documentació oficials) de la Diputació de
// Barcelona. No és un servidor MCP: src/dades.ts ho desa a la branca `dades`. Tots els processos
// tenen els mateixos camps: el que la font no dona és null.
import { getJson, SourceError, type Fetch } from './comun.ts';

export const CIDO = 'https://api.diba.cat/dadesobertes/cido/v1/oposicions';

// L'estat el posa el CIDO: «Termini obert» és el dels processos que admeten sol·licituds.
const TERMINI_OBERT = 3;
// El màxim que l'API dona en una pàgina.
const LIMIT = 2_000;

type Atributs = Record<string, unknown>;
type Pagina = {
  data: { id: string; type: string; attributes: Atributs }[];
  meta: { totalResourceCount: number };
};

const consulta = (offset: number) =>
  `${CIDO}?${new URLSearchParams({
    'filter[idEstat]': String(TERMINI_OBERT),
    // Sense un ordre fix, les pàgines d'una consulta paginada poden repetir o saltar processos.
    sort: 'id',
    'page[limit]': String(LIMIT),
    'page[offset]': String(offset),
  })}`;

function text(a: Atributs, nom: string, id: string): string | null {
  const valor = a[nom];
  if (valor === null) return null;
  if (typeof valor !== 'string')
    throw new SourceError(`El camp ${nom} del procés ${id} del CIDO no és text.`);
  return valor;
}

function obligatori(a: Atributs, nom: string, id: string) {
  const valor = text(a, nom, id);
  if (valor === null || valor.trim() === '')
    throw new SourceError(`El procés ${id} del CIDO no té ${nom}.`);
  return valor;
}

function data(a: Atributs, nom: string, id: string) {
  const valor = text(a, nom, id);
  if (valor !== null && !/^\d{4}-\d{2}-\d{2}$/.test(valor))
    throw new SourceError(`El camp ${nom} del procés ${id} del CIDO no és una data: ${valor}.`);
  return valor;
}

function places(a: Atributs, id: string) {
  const valor = a.numPlaces;
  if (valor === null) return null;
  if (!Number.isInteger(valor) || (valor as number) < 0)
    throw new SourceError(`El nombre de places del procés ${id} del CIDO no és un nombre.`);
  return valor as number;
}

function borsa(a: Atributs, id: string) {
  const valor = a.borsaTreball;
  if (typeof valor !== 'boolean')
    throw new SourceError(`El procés ${id} del CIDO no diu si és una borsa de treball.`);
  return valor;
}

export async function construirOposicions(fetchImpl: Fetch, avui: string) {
  const processos: Pagina['data'] = [];
  let total: number | null = null;
  do {
    const pagina = await getJson<Pagina>(fetchImpl, consulta(processos.length));
    // Si el total canvia entre pàgines, la font s'ha actualitzat a mitja lectura i les pàgines no
    // lliguen entre elles.
    if (total !== null && pagina.meta.totalResourceCount !== total)
      throw new SourceError('El CIDO ha canviat mentre es llegia: torna-ho a provar.');
    if (!Number.isInteger(pagina.meta.totalResourceCount))
      throw new SourceError('El CIDO no diu quants processos oberts té.');
    total = pagina.meta.totalResourceCount;
    if (pagina.data.length === 0) break;
    processos.push(...pagina.data);
  } while (processos.length < total);
  if (processos.length !== total)
    throw new SourceError(
      `El CIDO diu que té ${total} processos oberts i n'ha donat ${processos.length}.`,
    );
  // El CIDO sempre té processos oberts: una llista buida voldria dir que la consulta ja no filtra
  // com s'espera, no que no se'n pugui demanar cap.
  if (total === 0) throw new SourceError('El CIDO no té cap procés de selecció obert.');

  const vistos = new Set<string>();
  const llista = processos.map(({ id, type, attributes: a }) => {
    if (!/^\d+$/.test(id)) throw new SourceError(`Identificador del CIDO inesperat: ${id}.`);
    if (type !== 'oposicions') throw new SourceError(`El CIDO ha tornat un recurs ${type}.`);
    if (vistos.has(id)) throw new SourceError(`El procés ${id} del CIDO surt dues vegades.`);
    vistos.add(id);
    if (a.idEstat !== TERMINI_OBERT)
      throw new SourceError(`El procés ${id} del CIDO no té el termini obert.`);
    return {
      id,
      identificador: obligatori(a, 'identificador', id),
      titol: obligatori(a, 'titol', id),
      institucio: obligatori(a, 'institucioDesenvolupat', id),
      ambit: obligatori(a, 'ambit', id),
      borsa_treball: borsa(a, id),
      tipus_personal: text(a, 'tipusPersonal', id),
      grup_titulacio: text(a, 'grupTitulacio', id),
      sistema_seleccio: text(a, 'sistemaSeleccio', id),
      places: places(a, id),
      inici: data(a, 'dataInici', id),
      fi: data(a, 'dataFinalitzacio', id),
      hora_fi: text(a, 'horaFinalitzacio', id),
      observacions_termini: text(a, 'observacionsTermini', id),
      url: obligatori(a, 'urlCido', id),
    };
  });

  return {
    font: "CIDO, Cercador d'informació i documentació oficials (Diputació de Barcelona)",
    url: 'https://cido.diba.cat/oposicions',
    data_consulta: avui,
    nota: 'Els processos de selecció de personal (oposicions, concursos i borses de treball) de les administracions catalanes que el CIDO marca amb el termini de presentació obert el dia de la consulta. L’estat el posa el CIDO, i no es compara amb les dates. Els camps són tal com els escriu la font; el que no dona és null. Si un procés no té data de finalització, observacions_termini sol dir per què (per exemple, que és obert permanentment). Van ordenats per la data de finalització, els que no en tenen al final, i després per l’identificador del CIDO.',
    processos: llista.sort(
      (a, b) =>
        Number(a.fi === null) - Number(b.fi === null) ||
        (a.fi ?? '').localeCompare(b.fi ?? '') ||
        Number(a.id) - Number(b.id),
    ),
  };
}
