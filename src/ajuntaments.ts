// Els ajuntaments de tots els municipis de Catalunya i qui forma el seu ple, del registre d'ens
// locals de la Generalitat (Municat). No és un servidor MCP: src/dades.ts ho desa a la branca
// `dades`. Totes dues fonts són de la Secretaria de Governs Locals, a Dades obertes de Catalunya.
// Tots els municipis i totes les persones tenen els mateixos camps: el que la font no dona és null.
import { dia, getJson, metadades, SOCRATA, SourceError, type Fetch } from './comun.ts';

export const PLENS = 'nm3n-3vbj';
export const ENS_LOCALS = '6nei-4b44';
const LIMIT = 50_000;

type Fila = Record<string, unknown>;

/** Socrata omet els camps nuls: un camp que falta és null, i un d'obligatori que falta, un error. */
function camp(fila: Fila, nom: string): string | null {
  const valor = fila[nom];
  if (valor === undefined) return null;
  if (typeof valor !== 'string') throw new SourceError(`El camp ${nom} no és text: ${valor}.`);
  return valor;
}

function obligatori(fila: Fila, nom: string, conjunt: string) {
  const valor = camp(fila, nom);
  if (valor === null || valor.trim() === '')
    throw new SourceError(`Una fila de ${conjunt} no té ${nom}.`);
  return valor;
}

function numero(text: string, nom: string) {
  if (!/^\d+$/.test(text)) throw new SourceError(`${nom} no és un nombre: ${text}.`);
  return Number(text);
}

/**
 * Els sis primers dígits dels codis de Municat són el codi del municipi de l'INE amb el dígit de
 * control, el mateix que fa servir l'Idescat. És el que lliga les dues fonts.
 */
function codiMunicipi(codi: string) {
  if (!/^\d{10}$/.test(codi)) throw new SourceError(`Codi d'ens inesperat: ${codi}.`);
  return codi.slice(0, 6);
}

async function files(fetchImpl: Fetch, id: string, params: Record<string, string>) {
  const resultat = await getJson<Fila[]>(
    fetchImpl,
    `${SOCRATA}/resource/${id}.json?${new URLSearchParams({ ...params, $limit: String(LIMIT) })}`,
  );
  if (resultat.length === LIMIT) throw new SourceError(`El conjunt ${id} no cap en una pàgina.`);
  return resultat;
}

function persona(fila: Fila) {
  const data = camp(fila, 'data_nomenament');
  return {
    nom: camp(fila, 'nom'),
    carrec: camp(fila, 'carrec'),
    area: camp(fila, 'area'),
    partit: camp(fila, 'partit_politic'),
    ordre: numero(obligatori(fila, 'ordre', PLENS), 'L’ordre'),
    data_nomenament: data === null ? null : data.slice(0, 10),
  };
}

export async function construirAjuntaments(fetchImpl: Fetch) {
  const metaEns = await metadades(fetchImpl, ENS_LOCALS);
  const municipis = await files(fetchImpl, ENS_LOCALS, {
    $select: 'codi_ens, nom_complert, comarca, provincia, cens, any_cens, web',
    $where: "nomtipus = 'Municipis'",
    $order: 'codi_ens',
  });
  const metaPlens = await metadades(fetchImpl, PLENS);
  const electes = await files(fetchImpl, PLENS, {
    $select: 'codi_10, nom_ens, nom, carrec, area, partit_politic, ordre, data_nomenament',
    $where: "codi_tipus_ens = '2'",
    $order: 'codi_10, ordre',
  });
  if (municipis.length === 0 || electes.length === 0)
    throw new SourceError('El registre d’ens locals o la composició dels plens són buits.');

  const plens = new Map<string, { ajuntament: string; ple: ReturnType<typeof persona>[] }>();
  for (const fila of electes) {
    const codi = codiMunicipi(obligatori(fila, 'codi_10', PLENS));
    const ajuntament = obligatori(fila, 'nom_ens', PLENS);
    const ple = plens.get(codi) ?? { ajuntament, ple: [] };
    if (ple.ajuntament !== ajuntament)
      throw new SourceError(`El codi ${codi} correspon a ${ple.ajuntament} i a ${ajuntament}.`);
    ple.ple.push(persona(fila));
    plens.set(codi, ple);
  }
  // L'ordre al ple és el de la font. Es posa aquí i no a la consulta: un municipi pot tenir diversos
  // codi_10, i Socrata ordena primer per codi.
  for (const { ajuntament, ple } of plens.values()) {
    ple.sort((a, b) => a.ordre - b.ordre);
    if (new Set(ple.map((p) => p.ordre)).size !== ple.length)
      throw new SourceError(`El ple de ${ajuntament} té dues persones amb el mateix ordre.`);
  }

  const vistos = new Set<string>();
  const resultat = municipis.map((fila) => {
    const codi = codiMunicipi(obligatori(fila, 'codi_ens', ENS_LOCALS));
    const nom = obligatori(fila, 'nom_complert', ENS_LOCALS);
    if (vistos.has(codi)) throw new SourceError(`El municipi ${codi} surt dues vegades.`);
    vistos.add(codi);
    const ple = plens.get(codi);
    if (ple === undefined)
      throw new SourceError(`${nom} (${codi}) no té ple a la composició dels plens.`);
    const cens = camp(fila, 'cens');
    const anyCens = camp(fila, 'any_cens');
    // Uns habitants sense l'any, o un any sense habitants, no es poden mostrar bé.
    if ((cens === null) !== (anyCens === null))
      throw new SourceError(`${nom} té els habitants o l’any del padró, però no tots dos.`);
    return {
      codi,
      nom,
      ajuntament: ple.ajuntament,
      comarca: obligatori(fila, 'comarca', ENS_LOCALS),
      provincia: obligatori(fila, 'provincia', ENS_LOCALS),
      habitants: cens === null ? null : numero(cens, 'El cens'),
      any_habitants: anyCens === null ? null : numero(anyCens, 'L’any del cens'),
      web: camp(fila, 'web'),
      ple: ple.ple,
    };
  });
  const sensMunicipi = [...plens.keys()].filter((codi) => !vistos.has(codi));
  if (sensMunicipi.length > 0)
    throw new SourceError(
      `La composició dels plens té ajuntaments que no són al registre: ${sensMunicipi.join(', ')}.`,
    );

  return {
    font: `Dades obertes de Catalunya: ${metaPlens.name} (${metaPlens.attribution})`,
    url: `${SOCRATA}/d/${PLENS}`,
    data_dades: dia(metaPlens),
    font_municipis: `Dades obertes de Catalunya: ${metaEns.name} (${metaEns.attribution})`,
    url_municipis: `${SOCRATA}/d/${ENS_LOCALS}`,
    data_municipis: dia(metaEns),
    nota: 'Qui forma cada ple, amb el càrrec, l’àrea i el partit, surt de la composició dels plens. El nom del municipi, la comarca, la província, els habitants i la web surten del registre d’ens locals (Municat). Els noms, els càrrecs i els partits es publiquen tal com els escriu la font. Un camp que la font no dona és null, igual per a tothom.',
    municipis: resultat.sort((a, b) => a.nom.localeCompare(b.nom, 'ca')),
  };
}
