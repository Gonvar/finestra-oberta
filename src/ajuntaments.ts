// Els ajuntaments de tots els municipis de Catalunya i qui forma el seu ple, del registre d'ens
// locals de la Generalitat (Municat). No és un servidor MCP: src/dades.ts ho desa a la branca
// `dades`. Totes dues fonts són de la Secretaria de Governs Locals, a Dades obertes de Catalunya.
// Cada municipi es mostra amb els mateixos camps, i les persones del ple en l'ordre que dona la font.
import { dia, getJson, metadades, SOCRATA, SourceError, type Fetch } from './comun.ts';

export const PLENS = 'nm3n-3vbj';
export const ENS_LOCALS = '6nei-4b44';
const LIMIT = 50_000;

/** Una persona electa, tal com la dona la composició dels plens. */
type Electe = {
  codi_10: string;
  nom_ens: string;
  nom?: string;
  carrec?: string;
  area?: string;
  partit_politic?: string;
  ordre: string;
  data_nomenament?: string;
};

/** Un municipi, tal com el dona el registre d'ens locals. */
type Municipi = {
  codi_ens: string;
  nom_complert: string;
  comarca: string;
  provincia: string;
  cens?: string;
  any_cens?: string;
  web?: string;
};

/**
 * Els sis primers dígits dels codis de Municat són el codi del municipi de l'INE amb el dígit de
 * control, el mateix que fa servir l'Idescat. És el que lliga les dues fonts.
 */
function codiMunicipi(codi: string) {
  if (!/^\d{10}$/.test(codi)) throw new SourceError(`Codi d'ens inesperat: ${codi}.`);
  return codi.slice(0, 6);
}

async function files<T>(fetchImpl: Fetch, id: string, params: Record<string, string>) {
  const resultat = await getJson<T[]>(
    fetchImpl,
    `${SOCRATA}/resource/${id}.json?${new URLSearchParams({ ...params, $limit: String(LIMIT) })}`,
  );
  if (resultat.length === LIMIT) throw new SourceError(`El conjunt ${id} no cap en una pàgina.`);
  return resultat;
}

const numero = (text: string, camp: string) => {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) throw new SourceError(`${camp} no és un nombre: ${text}.`);
  return n;
};

export async function construirAjuntaments(fetchImpl: Fetch) {
  const metaEns = await metadades(fetchImpl, ENS_LOCALS);
  const municipis = await files<Municipi>(fetchImpl, ENS_LOCALS, {
    $select: 'codi_ens, nom_complert, comarca, provincia, cens, any_cens, web',
    $where: "nomtipus = 'Municipis'",
    $order: 'codi_ens',
  });
  const metaPlens = await metadades(fetchImpl, PLENS);
  const electes = await files<Electe>(fetchImpl, PLENS, {
    $select: 'codi_10, nom_ens, nom, carrec, area, partit_politic, ordre, data_nomenament',
    $where: "codi_tipus_ens = '2'",
    $order: 'codi_10, ordre',
  });
  if (municipis.length === 0 || electes.length === 0)
    throw new SourceError('El registre d’ens locals o la composició dels plens són buits.');

  const plens = new Map<string, { ens: string; ple: Electe[] }>();
  for (const electe of electes) {
    const codi = codiMunicipi(electe.codi_10);
    const ple = plens.get(codi) ?? { ens: electe.nom_ens, ple: [] };
    if (ple.ens !== electe.nom_ens)
      throw new SourceError(`El codi ${codi} correspon a ${ple.ens} i a ${electe.nom_ens}.`);
    ple.ple.push(electe);
    plens.set(codi, ple);
  }

  const vistos = new Set<string>();
  const resultat = municipis.map((m) => {
    const codi = codiMunicipi(m.codi_ens);
    if (vistos.has(codi)) throw new SourceError(`El municipi ${codi} surt dues vegades.`);
    vistos.add(codi);
    const ple = plens.get(codi);
    if (ple === undefined)
      throw new SourceError(`${m.nom_complert} (${codi}) no té ple a la composició dels plens.`);
    return {
      codi,
      nom: m.nom_complert,
      ajuntament: ple.ens,
      comarca: m.comarca,
      provincia: m.provincia,
      ...(m.cens !== undefined && {
        habitants: numero(m.cens, 'El cens'),
        ...(m.any_cens !== undefined && { any_habitants: numero(m.any_cens, 'L’any del cens') }),
      }),
      ...(m.web !== undefined && { web: m.web }),
      // Un seient sense nom, càrrec o partit es publica igual, sense el camp que la font no dona.
      ple: ple.ple.map((e) => ({
        ...(e.nom !== undefined && { nom: e.nom }),
        ...(e.carrec !== undefined && { carrec: e.carrec }),
        ...(e.area !== undefined && { area: e.area }),
        ...(e.partit_politic !== undefined && { partit: e.partit_politic }),
        ordre: numero(e.ordre, 'L’ordre'),
        ...(e.data_nomenament !== undefined && {
          data_nomenament: e.data_nomenament.slice(0, 10),
        }),
      })),
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
    nota: 'Qui forma cada ple, amb el càrrec, l’àrea i el partit, surt de la composició dels plens. El nom del municipi, la comarca, la província, els habitants i la web surten del registre d’ens locals (Municat). Els noms, els càrrecs i els partits es publiquen tal com els escriu la font, i un camp que la font no dona no hi és.',
    municipis: resultat.sort((a, b) => a.nom.localeCompare(b.nom, 'ca')),
  };
}
