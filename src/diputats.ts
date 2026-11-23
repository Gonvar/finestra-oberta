// El que el Parlament publica de cada persona diputada a la seva fitxa, a més de la composició de
// src/institucions.ts: els òrgans on és, la biografia, les rendes que ha cobrat del Parlament, les
// declaracions de béns, d'activitats i d'interessos, i l'agenda del mes. No és un servidor MCP:
// src/dades.ts ho desa a diputats.json, a la branca `dades`.
//
// El Parlament no ho publica en un format de dades: es llegeix del seu web. Els textos es desen tal
// com hi surten i en el mateix ordre, sense etiquetes HTML. Si una pàgina té una forma que aquí no es
// llegeix, val més aturar-se que publicar-ne només una part.
import { AVIS_LEGAL_PARLAMENT, llegirAgendaParlament } from './agenda.ts';
import {
  comprovaCodificacio,
  euros,
  getText,
  pausa,
  SourceError,
  text,
  type Fetch,
} from './comun.ts';

const PARLAMENT = 'https://www.parlament.cat';
const FITXES = `${PARLAMENT}/web/composicio/diputats-fitxa`;

/**
 * Les declaracions de la fitxa, per l'adreça de la seva pàgina. Les de béns, activitats i interessos
 * i les rendes es llegeixen senceres. Els dos compromisos són el mateix text signat per tothom, i
 * només s'enllacen. Una declaració nova s'ha de decidir aquí abans de publicar-la.
 */
const DECLARACIONS: Record<string, 'llegeix' | 'enllaca'> = {
  'rendes-anuals': 'llegeix',
  'declaracions-bens': 'llegeix',
  'declaracions-activitats': 'llegeix',
  'declaracions-econom': 'llegeix',
  'declaracions-tolerancia': 'enllaca',
  'declaracions-igualtat': 'enllaca',
};

export const agendaUrl = (codi: string, any: number, mes: number) =>
  `${FITXES}/agenda/index.html?${new URLSearchParams({
    p_categoria: '',
    p_hr: 'AGENDA_DIPUTAT',
    p_codi: codi,
    p_mode: 'M',
    p_data: `01${String(mes).padStart(2, '0')}${any}`,
  })}`;

/** «13.09.2024» o «13/09/2024» en ISO. */
function diaDelWeb(dma: string, url: string) {
  const m = dma.match(/^(\d\d)[./](\d\d)[./](\d{4})$/);
  if (m === null) throw new SourceError(`${url} té una data amb una forma inesperada: ${dma}.`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Un apartat de la fitxa: de la seva àncora fins a la següent, o fins al final del contingut. */
function apartat(html: string, nom: string) {
  const inici = html.indexOf(`<a name="${nom}"></a>`);
  if (inici === -1) return undefined;
  const finals = [
    html.indexOf('<a name="', inici + 1),
    html.indexOf('id="cs_columna_dreta"', inici),
  ];
  const final = Math.min(...finals.filter((i) => i !== -1));
  return html.slice(inici, final);
}

export type Carrec = {
  organ: string;
  /** Alguns grups de treball surten sense enllaç. */
  url?: string;
  /** El càrrec dins de l'òrgan, quan la fitxa en diu un («Presidenta», «Especialista»). */
  carrec?: string;
  alta: string;
  baixa?: string;
};

/**
 * Un element de la llista. Les ponències, els grups de treball i les reunions de portaveus van a
 * sota de la seva comissió. Qui hi és sense ser a la comissió hi té només el nom de la comissió.
 */
export type ElementCarrec =
  (Carrec & { relacionats?: Carrec[] }) | { organ: string; relacionats: Carrec[] };

// «. . Alta: 13.09.2024, BOPC, 44.  Baixa 26.11.2025.»: entre els dos primers punts hi ha el càrrec,
// si n'hi ha.
const DETALL_CARREC =
  /^\. ([^.]*)\. Alta: (\d\d\.\d\d\.\d{4})(?:, BOPC, \d+)?\.(?: Baixa (\d\d\.\d\d\.\d{4})(?:, BOPC, \d+)?\.)?$/;

/** Un element: l'enllaç o el nom de l'òrgan, i el que diu la fitxa a continuació. */
function carrec(element: string, url: string): Carrec {
  const enllac = element.match(/^<a href="([^"]*)">([^<]*)<\/a>([^<]*)$/);
  // Sense enllaç, el nom acaba on comença el detall: el càrrec no porta cap punt.
  const solt = /^[^<]+$/.test(element) ? text(element).match(/^(.+?)(\. [^.]*\. Alta: .*)$/) : null;
  const parts = enllac
    ? { organ: text(enllac[2]!), detall: text(enllac[3]!) }
    : solt && { organ: solt[1]!, detall: solt[2]! };
  const m = parts && parts.detall.match(DETALL_CARREC);
  if (!parts || !m)
    throw new SourceError(`${url} té un càrrec amb una forma inesperada: ${text(element)}.`);
  return {
    organ: parts.organ,
    ...(enllac && { url: new URL(text(enllac[1]!), url).href }),
    ...(m[1] && { carrec: m[1] }),
    alta: diaDelWeb(m[2]!, url),
    ...(m[3] && { baixa: diaDelWeb(m[3], url) }),
  };
}

/** Els òrgans de l'apartat «Càrrecs parlamentaris», en l'ordre de la fitxa. */
export function llegirCarrecs(html: string, url: string): ElementCarrec[] {
  const tros = apartat(html, 'carrecs');
  if (tros === undefined) throw new SourceError(`${url} no té l'apartat dels càrrecs.`);
  const llista = tros.match(/<ul class="llista_simple">([\s\S]*)<\/ul>/)?.[1];
  if (llista === undefined) return [];
  const carrecs: ElementCarrec[] = [];
  for (const [, cap, dins] of llista.matchAll(
    /<li>((?:(?!<ul|<\/li>)[\s\S])*)(?:<ul class="links_relacionats">([\s\S]*?)<\/ul>)?<\/li>/g,
  )) {
    const relacionats = [...(dins ?? '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((r) =>
      carrec(r[1]!.trim(), url),
    );
    // Una comissió sense dates és la que conté la ponència o el grup de treball de la persona.
    if (!cap!.includes('Alta:')) {
      if (!relacionats.length || cap!.includes('<'))
        throw new SourceError(`${url} té un càrrec amb una forma inesperada: ${text(cap!)}.`);
      carrecs.push({ organ: text(cap!), relacionats });
    } else
      carrecs.push({ ...carrec(cap!.trim(), url), ...(relacionats.length && { relacionats }) });
  }
  // Un element amb una altra forma es perdria sense que ningú ho sabés.
  const llegits = carrecs.reduce((n, c) => n + 1 + (c.relacionats?.length ?? 0), 0);
  if (llegits !== (llista.match(/<li>/g) ?? []).length)
    throw new SourceError(`${url} té càrrecs amb una forma inesperada.`);
  return carrecs;
}

export type Biografia = {
  /** La data que dona la fitxa: la de quan es va presentar o la de l'última actualització. */
  data: { que: 'Presentació' | 'Actualització'; dia: string };
  apartats: { titol: string; linies: string[] }[];
};

const linies = (html: string) =>
  html
    .split(/<br\s*\/?>/i)
    .map(text)
    .filter(Boolean);

/** La biografia que la persona presenta al Parlament. No tothom en té. */
export function llegirBiografia(html: string, url: string): Biografia | undefined {
  const tros = apartat(html, 'biografia');
  if (tros === undefined) return undefined;
  const data = tros.match(/\((Presentació|Actualització): (\d\d\.\d\d\.\d{4})\)/);
  if (data === null) throw new SourceError(`La biografia de ${url} no diu de quan és.`);
  const apartats = [
    ...tros.matchAll(
      /<h3 class="sub_titol_caixa"><span>([^<]*)<\/span><\/h3>((?:(?!<h3)[\s\S])*)/g,
    ),
  ].map((m) => {
    const paragrafs = [...m[2]!.matchAll(/<p class="text">([\s\S]*?)<\/p>/g)];
    // Un text fora dels paràgrafs es perdria sense que ningú ho sabés.
    if (paragrafs.length === 0 || text(m[2]!.replace(/<p class="text">[\s\S]*?<\/p>/g, '')))
      throw new SourceError(`La biografia de ${url} té una forma inesperada.`);
    return { titol: text(m[1]!), linies: paragrafs.flatMap((p) => linies(p[1]!)) };
  });
  const abans = tros.slice(tros.indexOf('</h2>'), tros.indexOf('<h3'));
  if (apartats.length !== (tros.match(/<h3/g) ?? []).length || apartats.length === 0 || text(abans))
    throw new SourceError(`La biografia de ${url} té una forma inesperada.`);
  return {
    data: { que: data[1] as 'Presentació' | 'Actualització', dia: diaDelWeb(data[2]!, url) },
    apartats,
  };
}

/** Les declaracions que enllaça la fitxa, en el seu ordre. */
export function llegirEnllacosDeclaracions(html: string, url: string) {
  const tros = apartat(html, 'declaracio');
  if (tros === undefined) return [];
  const enllacos = [...tros.matchAll(/<a title="([^"]*)" href="([^"]*)">/g)].map((m) => {
    const adreca = new URL(text(m[2]!), url);
    const tipus = adreca.pathname.match(/\/diputats-fitxa\/([\w-]+)\/index\.html$/)?.[1];
    const que = tipus && DECLARACIONS[tipus];
    if (!que)
      throw new SourceError(`${url} enllaça una declaració que no es coneix: ${adreca.pathname}.`);
    return { titol: text(m[1]!), url: adreca.href, tipus, que };
  });
  if (enllacos.length !== (tros.match(/<a (?!name=)/g) ?? []).length)
    throw new SourceError(`${url} té un enllaç a una declaració amb una forma inesperada.`);
  return enllacos;
}

/** Un tros d'una declaració, en l'ordre de la pàgina. */
export type Bloc =
  | { titol: string }
  /** El que demana el formulari, quan la resposta va a sota («Plans de pensions i assimilats»). */
  | { pregunta: string }
  | { text: string[] }
  | { taula: { columnes: string[]; files: string[][] } }
  /** El missatge del Parlament quan la declaració encara no té dades. */
  | { avis: string };

export type Declaracio = {
  titol: string;
  /** La data que la pàgina posa al títol: la de la declaració o, a les rendes, la de publicació. */
  data?: string;
  url: string;
  blocs: Bloc[];
};

const celes = (fila: string, etiqueta: 'th' | 'td') =>
  [...fila.matchAll(new RegExp(`<${etiqueta}\\b[^>]*>([\\s\\S]*?)<\\/${etiqueta}>`, 'g'))].map(
    (m) => text(m[1]!),
  );

function taula(html: string, url: string) {
  const capcalera = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1];
  const cos = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  if (capcalera === undefined || cos === undefined)
    throw new SourceError(`${url} té una taula sense capçalera o sense files.`);
  const columnes = celes(capcalera, 'th');
  const files = [...cos.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => celes(m[1]!, 'td'));
  if (files.length !== (cos.match(/<tr\b/gi) ?? []).length)
    throw new SourceError(`${url} té una taula amb files que no es llegeixen.`);
  if (files.some((f) => f.length !== columnes.length))
    throw new SourceError(
      `${url} té una taula amb files que no tenen les columnes de la capçalera.`,
    );
  return { columnes, files };
}

// Les etiquetes que poden sortir dins d'una declaració. Una altra és una forma que no s'ha vist mai,
// i el que hi hagués a dins podria no llegir-se bé.
const ETIQUETES = new Set([
  'a',
  'br',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'h3',
  'h4',
  'img',
  'li',
  'p',
  'span',
  'strong',
  'ul',
]);

/** Una pàgina de declaració, com a llista de blocs: el text de la font, en el seu ordre. */
export function llegirDeclaracio(html: string, url: string, codi: string): Declaracio {
  comprovaCodificacio(html, url);
  // Cada pàgina enllaça la fitxa de la persona: si és la d'una altra, la pàgina no és la que es demanava.
  if (!html.includes(`/web/composicio/diputats-fitxa/index.html?p_codi=${codi}#declaracio"`))
    throw new SourceError(`${url} no és una declaració de la persona ${codi}.`);
  const inici = html.indexOf('<h2 class="titol_caixa">', html.indexOf('Tornar a la fitxa'));
  const final = html.indexOf('id="cs_columna_dreta"', inici);
  if (inici === -1 || final === -1)
    throw new SourceError(`${url} no té la declaració on s'esperava.`);
  const tros = html.slice(inici, final).replace(/<!--[\s\S]*?-->/g, '');
  const capcalera = tros.match(/^<h2 class="titol_caixa"><span>([^<]*)<\/span><\/h2>/);
  if (capcalera === null) throw new SourceError(`${url} no té el títol on s'esperava.`);
  const titol = text(capcalera[1]!).match(/^(.+?)(?: \((\d\d\/\d\d\/\d{4})\))?$/);
  if (titol === null) throw new SourceError(`${url} té el títol buit.`);

  // Les taules no porten cap altre bloc a dins: es treuen primer i es deixa una marca al seu lloc.
  const taules: Bloc[] = [];
  const cos = tros
    .slice(capcalera[0].length)
    .replace(/<table\b[^>]*>([\s\S]*?)<\/table>/g, (_, dins: string) => {
      taules.push({ taula: taula(dins, url) });
      return `\u0000${taules.length - 1}\u0000`;
    })
    // El que queda del final de la columna és només de maquetació.
    .replace(/<\/div>\s*<\/td>\s*<td [^>]*$/, '');
  for (const [, etiqueta] of cos.matchAll(/<\/?(\w+)/g))
    if (!ETIQUETES.has(etiqueta!.toLowerCase()))
      throw new SourceError(`${url} té una etiqueta <${etiqueta}> que no es llegeix.`);

  const blocs: Bloc[] = [];
  let actual: string[] = [];
  let linia = '';
  const tancaLinia = () => {
    const net = text(linia);
    if (net) actual.push(net);
    linia = '';
  };
  const tancaText = () => {
    tancaLinia();
    if (actual.length) blocs.push({ text: actual });
    actual = [];
  };
  let darrer = 0;
  for (const m of cos.matchAll(
    /<(h3|h4)\b[^>]*>([\s\S]*?)<\/\1>|<dt>([\s\S]*?)<\/dt>|<p><img [^>]*missatge_info[^>]*>([\s\S]*?)<\/p>|\u0000(\d+)\u0000|(<br\s*\/?>)|<\/?(?:p|dd|li|div)\b[^>]*>/gi,
  )) {
    linia += cos.slice(darrer, m.index);
    darrer = m.index + m[0].length;
    if (m[6]) {
      tancaLinia();
      continue;
    }
    tancaText();
    if (m[2] !== undefined) blocs.push({ titol: text(m[2]) });
    else if (m[3] !== undefined) blocs.push({ pregunta: text(m[3]) });
    else if (m[4] !== undefined) blocs.push({ avis: text(m[4]) });
    else if (m[5] !== undefined) blocs.push(taules[Number(m[5])]!);
  }
  linia += cos.slice(darrer);
  tancaText();
  if (blocs.length === 0) throw new SourceError(`${url} és una declaració buida.`);
  return {
    titol: titol[1]!,
    ...(titol[2] && { data: diaDelWeb(titol[2], url) }),
    url,
    blocs,
  };
}

/**
 * Les rendes de cada any, de la taula que va després de «Anualitat 2025». Són les xifres que la web
 * pot comparar entre persones, i per això es llegeixen com a imports i no només com a text.
 */
export function anualitats(rendes: Declaracio) {
  const anys = [];
  for (const [i, bloc] of rendes.blocs.entries()) {
    if (!('titol' in bloc)) continue;
    const any = bloc.titol.match(/^Anualitat (\d{4})$/)?.[1];
    if (any === undefined) continue;
    const seguent = rendes.blocs[i + 1];
    if (
      seguent === undefined ||
      !('taula' in seguent) ||
      seguent.taula.columnes.length !== 2 ||
      seguent.taula.files.length === 0
    )
      throw new SourceError(`${rendes.url} no té la taula de l'anualitat ${any}.`);
    anys.push({
      any: Number(any),
      conceptes: seguent.taula.files.map(([concepte, import_]) => ({
        concepte: concepte!,
        import: euros(import_!),
      })),
    });
  }
  return anys;
}

type Fitxa = { codi: string; nom: string; url: string; html: string };

/**
 * Tot el que la fitxa de cada persona diputada diu o enllaça, menys la composició, que és a
 * parlament.json. L'agenda és la del mes de `avui`.
 */
export async function construirDiputats(
  fetchImpl: Fetch,
  fitxes: Fitxa[],
  avui: string,
  pausaMs = 300,
) {
  const [any, mes] = avui.split('-').map(Number) as [number, number];
  const llegeix = async (url: string) => {
    // D'una en una i amb pausa, com les fitxes: són pàgines del web del Parlament, no una API.
    await pausa(pausaMs);
    return getText(fetchImpl, url);
  };
  const diputats = [];
  for (const { codi, nom, url, html } of fitxes) {
    const enllacos = llegirEnllacosDeclaracions(html, url);
    const declaracions = [];
    let rendes;
    for (const e of enllacos.filter((e) => e.que === 'llegeix')) {
      const declaracio = llegirDeclaracio(await llegeix(e.url), e.url, codi);
      if (e.tipus === 'rendes-anuals') {
        if (rendes !== undefined)
          throw new SourceError(`${url} enllaça més d'una pàgina de rendes.`);
        rendes = { ...declaracio, anualitats: anualitats(declaracio) };
      } else declaracions.push(declaracio);
    }
    const urlAgenda = agendaUrl(codi, any, mes);
    const actes = llegirAgendaParlament(await llegeix(urlAgenda), urlAgenda, any, mes);
    const biografia = llegirBiografia(html, url);
    diputats.push({
      codi,
      nom,
      fitxa: url,
      carrecs: llegirCarrecs(html, url),
      ...(biografia && { biografia }),
      ...(rendes && { rendes }),
      declaracions,
      compromisos: enllacos
        .filter((e) => e.que === 'enllaca')
        .map(({ titol, url }) => ({ titol, url })),
      agenda: { url: urlAgenda, actes },
    });
  }
  // Una fitxa sense càrrecs o sense declaracions pot ser la d'algú que acaba d'arribar, però si no
  // en té ningú és que la fitxa ha canviat de forma i no s'han trobat.
  if (diputats.every((d) => d.carrecs.length === 0))
    throw new SourceError('Cap fitxa de persona diputada no té càrrecs.');
  if (diputats.every((d) => d.rendes === undefined && d.declaracions.length === 0))
    throw new SourceError('Cap fitxa de persona diputada no té declaracions.');
  return {
    font: 'Parlament de Catalunya: fitxes de les persones diputades',
    data_consulta: avui,
    agenda: { any, mes },
    nota: `El Parlament no publica aquestes dades en un format de dades: es llegeixen de la fitxa de cada persona i de les pàgines que enllaça. Els textos són els del web, sense etiquetes HTML i en el mateix ordre. Les rendes són les que el Parlament va pagar l'any anterior, tal com les publica abans d'acabar el primer trimestre, i a anualitats hi ha els imports en euros. L'agenda és la del mes de data_consulta i la informa cada persona: el que no hi és pot ser que no s'hagi informat. El Parlament no publica qui ha votat què ni l'assistència de cada persona. L’avís legal (${AVIS_LEGAL_PARLAMENT}) en permet la reutilització si se’n cita la font, no se n’altera el sentit i no es presenta com una versió oficial ni avalada pel Parlament.`,
    diputats,
  };
}
