// Com va el pressupost de la Generalitat: quant té cada secció per gastar i quant n'ha gastat, i
// quant ha ingressat, de l'execució mensual que publica el Departament d'Economia i Finances. No és
// un servidor MCP: src/dades.ts ho desa a la branca `dades`. Les sumes les fa l'API de la font.
import { dia, getJson, metadades, SOCRATA, SourceError, type Fetch } from './comun.ts';

export const DESPESES = 'ajns-4mi7';
export const INGRESSOS = '42am-vra2';
const LIMIT = 50_000;

type Fila = Record<string, unknown>;

function text(fila: Fila, nom: string, conjunt: string) {
  const valor = fila[nom];
  if (typeof valor !== 'string' || valor.trim() === '')
    throw new SourceError(`Una fila de ${conjunt} no té ${nom}.`);
  return valor;
}

/** Les sumes arriben com a text amb punt decimal, «72760194753.04». */
export function euros(fila: Fila, nom: string, conjunt: string) {
  const valor = text(fila, nom, conjunt);
  if (!/^-?\d+(\.\d+)?$/.test(valor))
    throw new SourceError(`${nom} de ${conjunt} no és un import: ${valor}.`);
  return Number(valor);
}

const consulta = (id: string, params: Record<string, string>) =>
  `${SOCRATA}/resource/${id}.json?${new URLSearchParams({ ...params, $limit: String(LIMIT) })}`;

async function files(fetchImpl: Fetch, id: string, params: Record<string, string>) {
  const resultat = await getJson<Fila[]>(fetchImpl, consulta(id, params));
  if (resultat.length === LIMIT) throw new SourceError(`El conjunt ${id} no cap en una pàgina.`);
  if (resultat.length === 0) throw new SourceError(`El conjunt ${id} no té cap fila.`);
  return resultat;
}

/**
 * L'últim mes publicat. `mes` és text, «10 Octubre», i el número de davant fa que l'ordre de text
 * sigui el dels mesos.
 */
async function ultimMes(fetchImpl: Fetch, id: string) {
  const [fila] = await getJson<Fila[]>(
    fetchImpl,
    `${SOCRATA}/resource/${id}.json?${new URLSearchParams({
      $select: 'exercici, mes',
      $group: 'exercici, mes',
      $order: 'exercici DESC, mes DESC',
      $limit: '1',
    })}`,
  );
  if (fila === undefined) throw new SourceError(`El conjunt ${id} no té cap fila.`);
  const exercici = text(fila, 'exercici', id);
  const mes = text(fila, 'mes', id);
  if (!/^\d{4}$/.test(exercici) || !/^(0[1-9]|1[0-2]) \p{L}+$/u.test(mes))
    throw new SourceError(`Període inesperat a ${id}: ${exercici} ${mes}.`);
  return { exercici, mes };
}

/** Cada clau (entitat i secció, o entitat i capítol) només pot sortir una vegada. */
function unica(claus: string[], conjunt: string) {
  const vistes = new Set<string>();
  for (const clau of claus) {
    if (vistes.has(clau)) throw new SourceError(`${conjunt} repeteix ${clau}.`);
    vistes.add(clau);
  }
}

// Els valors surten d'ultimMes, que n'ha comprovat la forma: no poden portar cap cometa.
const periode = ({ exercici, mes }: { exercici: string; mes: string }) =>
  `exercici = ${exercici} and mes = '${mes}'`;

export async function construirPressupost(fetchImpl: Fetch) {
  const metaDespeses = await metadades(fetchImpl, DESPESES);
  const mesDespeses = await ultimMes(fetchImpl, DESPESES);
  const seccions = await files(fetchImpl, DESPESES, {
    $select: [
      'entitat_codi',
      'entitat',
      'ordre_protocol_secci',
      'secci_codi',
      'secci',
      'sum(cr_dits_inicials) as inicial',
      'sum(pressupost_definitiu) as definitiu',
      'sum(obligacions_reconegudes) as reconegut',
      'sum(obligacions_pagades) as pagat',
    ].join(', '),
    $where: periode(mesDespeses),
    $group: 'entitat_codi, entitat, ordre_protocol_secci, secci_codi, secci',
    $order: 'entitat_codi, ordre_protocol_secci, secci_codi',
  });
  const despeses = seccions.map((f) => ({
    entitat_codi: text(f, 'entitat_codi', DESPESES),
    entitat: text(f, 'entitat', DESPESES),
    seccio_codi: text(f, 'secci_codi', DESPESES),
    seccio: text(f, 'secci', DESPESES),
    ordre_protocol: text(f, 'ordre_protocol_secci', DESPESES),
    credit_inicial: euros(f, 'inicial', DESPESES),
    pressupost_definitiu: euros(f, 'definitiu', DESPESES),
    obligacions_reconegudes: euros(f, 'reconegut', DESPESES),
    obligacions_pagades: euros(f, 'pagat', DESPESES),
  }));
  unica(
    despeses.map((d) => `${d.entitat_codi}/${d.seccio_codi}`),
    'L’execució de despeses',
  );

  const metaIngressos = await metadades(fetchImpl, INGRESSOS);
  const mesIngressos = await ultimMes(fetchImpl, INGRESSOS);
  const capitols = await files(fetchImpl, INGRESSOS, {
    $select: [
      'entitat_codi',
      'entitat',
      'cap_tol_codi',
      'cap_tol',
      'sum(previsions_pressupost_ries) as inicial',
      'sum(previsions_finals) as finals',
      'sum(drets_reconeguts_nets) as reconegut',
      'sum(recaptaci_neta) as recaptat',
    ].join(', '),
    $where: periode(mesIngressos),
    $group: 'entitat_codi, entitat, cap_tol_codi, cap_tol',
    $order: 'entitat_codi, cap_tol_codi',
  });
  const ingressos = capitols.map((f) => ({
    entitat_codi: text(f, 'entitat_codi', INGRESSOS),
    entitat: text(f, 'entitat', INGRESSOS),
    capitol_codi: text(f, 'cap_tol_codi', INGRESSOS),
    capitol: text(f, 'cap_tol', INGRESSOS),
    previsio_inicial: euros(f, 'inicial', INGRESSOS),
    previsio_final: euros(f, 'finals', INGRESSOS),
    drets_reconeguts_nets: euros(f, 'reconegut', INGRESSOS),
    recaptacio_neta: euros(f, 'recaptat', INGRESSOS),
  }));
  unica(
    ingressos.map((i) => `${i.entitat_codi}/${i.capitol_codi}`),
    'L’execució d’ingressos',
  );

  return {
    font_despeses: `Dades obertes de Catalunya: ${metaDespeses.name} (${metaDespeses.attribution})`,
    url_despeses: `${SOCRATA}/d/${DESPESES}`,
    data_despeses: dia(metaDespeses),
    font_ingressos: `Dades obertes de Catalunya: ${metaIngressos.name} (${metaIngressos.attribution})`,
    url_ingressos: `${SOCRATA}/d/${INGRESSOS}`,
    data_ingressos: dia(metaIngressos),
    nota: 'L’execució del pressupost de la Generalitat i del seu sector públic a l’últim mes publicat. Segons la font, els imports són els acumulats des de l’1 de gener fins a l’últim dia del mes. Les despeses se sumen per entitat i secció, i els ingressos per entitat i capítol; les sumes les fa l’API de la font. No hi ha cap total de totes les entitats, perquè les transferències d’una entitat a una altra hi serien dues vegades. Els noms són tal com els escriu la font, i l’ordre és el seu: el codi de l’entitat i, després, l’ordre de protocol de la secció o el codi del capítol. Els imports són en euros.',
    despeses: { exercici: Number(mesDespeses.exercici), mes: mesDespeses.mes, seccions: despeses },
    ingressos: {
      exercici: Number(mesIngressos.exercici),
      mes: mesIngressos.mes,
      capitols: ingressos,
    },
  };
}
