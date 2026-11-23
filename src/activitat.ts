// Què ha decidit el Parlament: el resultat de cada punt de les sessions del Ple de la legislatura en
// curs i les lleis i els decrets llei publicats al DOGC. No és un servidor MCP: src/dades.ts ho desa
// a activitat.json perquè la web ho pugui mostrar.
//
// El Parlament no publica qui ha votat què ni l'assistència de cada persona diputada (ho diu el seu
// portal de transparència), i el recompte de vots només és dins el PDF del Diari de Sessions. Per
// això aquí no hi ha vots: el que no publica la font no s'endevina.
import { obligatori, type Fila } from './ajuntaments.ts';
import { dia, getJson, getText, metadades, SOCRATA, SourceError, type Fetch } from './comun.ts';
import { comprovaCodificacio, pausa, text } from './institucions.ts';

const PARLAMENT = 'https://www.parlament.cat';
export const SESSIONS_ORGANS = `${PARLAMENT}/web/activitat-parlamentaria/sessions-organs/index.html`;
export const NORMATIVA = 'n6hn-rmy7';
/** Les normes amb rang de llei que publica el DOGC: les lleis del Parlament i els decrets llei del Govern. */
export const RANGS = ['Llei', 'Decret llei'] as const;

/**
 * Quin resultat vol dir cada acord, per l'inici del text oficial. Només hi ha els acords que diuen
 * sense dubte que el Ple ha aprovat, convalidat, derogat o rebutjat la iniciativa. «S'aprova l'esmena a la
 * totalitat» o «Es rebutja l'esmena a la totalitat» parlen d'una esmena, no de la iniciativa, i
 * queden sense resultat, com la resta: el text oficial és sempre a `acord`.
 */
export const RESULTATS: [string, 'aprovat' | 'convalidat' | 'derogat' | 'rebutjat'][] = [
  ["S'aprova la Llei.", 'aprovat'],
  ["S'aprova la Moció.", 'aprovat'],
  ["S'aprova el Reglament.", 'aprovat'],
  ["S'adopta la Resolució.", 'aprovat'],
  ["S'aprova.", 'aprovat'],
  ["S'adopta.", 'aprovat'],
  ['Aprovació pel Ple del projecte de pressupost.', 'aprovat'],
  ['Es convalida el Decret llei', 'convalidat'],
  ['Es valida el Decret llei', 'convalidat'],
  // Un decret llei que el Ple no convalida queda derogat.
  ['Es deroga el Decret llei.', 'derogat'],
  ['Es rebutja.', 'rebutjat'],
];

const resultat = (acord: string) =>
  RESULTATS.find(([inici]) => acord.startsWith(inici))?.[1] ?? null;

const absoluta = (href: string) => new URL(href.replaceAll('&amp;', '&'), PARLAMENT).href;

/** La legislatura en curs és la primera de la llista; d'aquesta, l'enllaç a les sessions del Ple. */
export async function llistaDelPle(fetchImpl: Fetch) {
  const index = await getText(fetchImpl, SESSIONS_ORGANS);
  const legislatura = index.match(
    /<ul class="pagina_llistat">\s*<li>\s*<a href="([^"]*\/sessions-organs\/[\w-]+-legislatura\/index\.html)"/,
  );
  if (legislatura === null) throw new SourceError('La llista de legislatures no té cap enllaç.');
  const url = absoluta(legislatura[1]!);
  const organs = await getText(fetchImpl, url);
  const ple = organs.match(
    /href="([^"]*sessions-tingudes\/index\.html\?p_legislatura=(\d+)&amp;p_codi=(\d+))" title="Vegeu la informació de Ple del Parlament"/,
  );
  if (ple === null) throw new SourceError(`${url} no enllaça les sessions del Ple.`);
  return { url: absoluta(ple[1]!), legislatura: Number(ple[2]), organ: ple[3]! };
}

/** Una pàgina de la llista de sessions: el número, el caràcter, la data i l'enllaç als acords. */
export function llegirLlista(html: string, url: string) {
  comprovaCodificacio(html, url);
  const pagines = html.match(/Pàgina \d+ de (\d+)/);
  if (pagines === null) throw new SourceError(`${url} no diu quantes pàgines té.`);
  const sessions = [
    ...html.matchAll(
      /<span>Sessió núm\. (\d+), ([^<]+)<\/span>\s*<\/th>\s*<td>\s*<span>(\d\d)\/(\d\d)\/(\d{4}) - (\d\d:\d\d)h<\/span>[\s\S]*?href="([^"]*acords-sessions\/index\.html\?[^"]*p_sessio=\1)"/g,
    ),
  ].map(([, numero, caracter, d, m, a, hora, acords]) => ({
    numero: Number(numero),
    caracter: text(caracter!),
    data: `${a}-${m}-${d}`,
    hora: hora!,
    url: absoluta(acords!),
  }));
  // Cada fila de la taula és una sessió: si n'hi ha que no s'han pogut llegir, la pàgina ha canviat.
  const files = (html.match(/<span>Sessió núm\./g) ?? []).length;
  if (sessions.length === 0 || sessions.length !== files)
    throw new SourceError(
      `${url} té ${files} sessions i se n'han pogut llegir ${sessions.length}.`,
    );
  return { pagines: Number(pagines[1]), sessions };
}

/** Una pàgina dels punts de l'ordre del dia d'una sessió, amb l'acord tal com l'escriu el Parlament. */
export function llegirAcords(html: string, url: string) {
  comprovaCodificacio(html, url);
  const pagines = html.match(/Pàgina \d+ de (\d+)</);
  if (pagines === null) throw new SourceError(`${url} no diu quantes pàgines té.`);
  const llista = html.match(/<ul class="llista_numerada">([\s\S]*?)<\/ul>/);
  if (llista === null) throw new SourceError(`${url} no té la llista de punts.`);
  const elements = llista[1]!.split('<li>').slice(1);
  // Si la llista no es llegeix sencera (una etiqueta nova, una llista dins un punt), falten punts.
  const numerats = (html.match(/class="punt_ordre"/g) ?? []).length;
  if (elements.length === 0 || elements.length !== numerats)
    throw new SourceError(`${url} té ${numerats} punts i se n'han trobat ${elements.length}.`);
  const punts = elements.map((li) => {
    const m = li.match(
      /<strong class="punt_ordre">(\d+)<\/strong>\s*<div>\s*<p>([\s\S]*?)<\/p>\s*<p>Número d'expedient: <a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a><\/p>\s*<p><i>([^<]*)<\/i><\/p>/,
    );
    if (m === null) throw new SourceError(`Un punt de ${url} no té la forma esperada.`);
    const [, ordre, titol, expedient_url, expedient, acord] = m;
    const net = text(acord!);
    return {
      ordre: Number(ordre),
      titol: text(titol!),
      expedient: text(expedient!),
      url_expedient: absoluta(expedient_url!),
      acord: net,
      resultat: resultat(net),
    };
  });
  return { pagines: Number(pagines[1]), punts };
}

/** L'enllaç a l'última versió és un objecte amb `url`. */
function enllac(fila: Fila) {
  const valor = fila.url_ltima_versi_format_html;
  if (typeof valor !== 'object' || valor === null || typeof (valor as Fila).url !== 'string')
    throw new SourceError('Una norma del DOGC no té enllaç a l’última versió.');
  return (valor as { url: string }).url;
}

/** Les lleis i els decrets llei publicats al DOGC des de `des_de`, del més nou al més antic. */
export async function construirNormes(fetchImpl: Fetch, des_de: string) {
  const meta = await metadades(fetchImpl, NORMATIVA);
  const limit = 1000;
  const consulta = new URLSearchParams({
    $select:
      't_tol_de_la_norma,rang_de_norma,data_del_document,data_de_publicaci_del_diari,n_mero_de_diari,vig_ncia_de_la_norma,url_ltima_versi_format_html',
    $where: `rang_de_norma in (${RANGS.map((r) => `'${r}'`).join(',')}) AND data_de_publicaci_del_diari >= '${des_de}'`,
    $order: 'data_de_publicaci_del_diari DESC, n_mero_de_control DESC',
    $limit: String(limit),
  });
  const files = await getJson<Fila[]>(
    fetchImpl,
    `${SOCRATA}/resource/${NORMATIVA}.json?${consulta}`,
  );
  if (files.length === limit) throw new SourceError('Les normes no caben en una pàgina.');
  return {
    font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
    url: `${SOCRATA}/d/${NORMATIVA}`,
    data_dades: dia(meta),
    normes: files.map((f) => {
      const camp = (nom: string) => obligatori(f, nom, `la normativa del DOGC (${NORMATIVA})`);
      return {
        titol: camp('t_tol_de_la_norma').trim(),
        rang: camp('rang_de_norma'),
        data: camp('data_del_document').slice(0, 10),
        data_publicacio: camp('data_de_publicaci_del_diari').slice(0, 10),
        dogc: camp('n_mero_de_diari'),
        vigencia: camp('vig_ncia_de_la_norma'),
        url: enllac(f),
      };
    }),
  };
}

/** Totes les sessions del Ple de la legislatura en curs, de la més nova a la més antiga. */
export async function construirActivitat(fetchImpl: Fetch, avui: string, pausaMs = 300) {
  const ple = await llistaDelPle(fetchImpl);
  const primera = llegirLlista(await getText(fetchImpl, ple.url), ple.url);
  const llista = [...primera.sessions];
  for (let pagina = 2; pagina <= primera.pagines; pagina++) {
    const url = `${ple.url}&p_pagina=${pagina}`;
    await pausa(pausaMs);
    llista.push(...llegirLlista(await getText(fetchImpl, url), url).sessions);
  }
  // La llista repeteix algunes sessions, amb la mateixa data i el mateix enllaç. Una repetició
  // idèntica es desa una vegada; dues files diferents amb el mateix número són un error.
  const perNumero = new Map<number, (typeof llista)[number]>();
  for (const sessio of llista) {
    const vista = perNumero.get(sessio.numero);
    if (vista !== undefined && JSON.stringify(vista) !== JSON.stringify(sessio))
      throw new SourceError(
        `La sessió ${sessio.numero} del Ple surt dues vegades amb dades diferents.`,
      );
    perNumero.set(sessio.numero, sessio);
  }

  const sessions = [];
  for (const sessio of [...perNumero.values()].sort((a, b) => b.numero - a.numero)) {
    await pausa(pausaMs);
    const primeraPagina = llegirAcords(await getText(fetchImpl, sessio.url), sessio.url);
    const punts = [...primeraPagina.punts];
    for (let pagina = 2; pagina <= primeraPagina.pagines; pagina++) {
      const url = `${sessio.url}&p_pagina=${pagina}`;
      await pausa(pausaMs);
      punts.push(...llegirAcords(await getText(fetchImpl, url), url).punts);
    }
    const ordres = punts.map((p) => p.ordre);
    if (ordres.some((ordre, i) => ordre !== i + 1))
      throw new SourceError(`Els punts de ${sessio.url} no van d'1 a ${punts.length} seguits.`);
    sessions.push({ ...sessio, punts });
  }
  const constitutiva = sessions.at(-1)!;

  return {
    font: 'Parlament de Catalunya: sessions tingudes i acords del Ple',
    url: ple.url,
    data_consulta: avui,
    nota: 'El Parlament no publica qui ha votat què ni l’assistència de cada persona diputada, i el recompte de vots només surt al Diari de Sessions, en PDF. Per això aquí hi ha el resultat de cada punt, però no els vots. `acord` és el text del Parlament; `resultat` només hi és quan l’acord diu que la iniciativa s’aprova, es convalida, es deroga o es rebutja (vegeu RESULTATS a src/activitat.ts). Les normes són les lleis i els decrets llei publicats al DOGC des de la sessió constitutiva de la legislatura.',
    legislatura: ple.legislatura,
    sessions,
    normes: await construirNormes(fetchImpl, constitutiva.data),
  };
}
