// L'agenda pública del Govern i del Parlament: el mes passat, l'actual i el següent. No és un
// servidor MCP: src/dades.ts la desa a agenda.json, a la branca `dades`, amb les institucions.
// Com a la resta de dades, si una font canvia de forma, val més aturar-se que publicar una agenda
// a mitges.
import {
  comprovaCodificacio,
  getJson,
  getText,
  metadades,
  SOCRATA,
  SourceError,
  text,
  type Fetch,
} from './comun.ts';

export const ACTES_GOVERN = 'wf87-e34n';
const PARLAMENT = 'https://www.parlament.cat';
export const AGENDA_PARLAMENT = `${PARLAMENT}/web/actualitat/agenda/index.html`;
export const AVIS_LEGAL_PARLAMENT = `${PARLAMENT}/pcat/serveis-parlament/avis-legal`;

/**
 * Qui és el Govern, tal com ho classifica el conjunt: la presidència i el Consell Executiu. La resta
 * d'autoritats del conjunt (secretaris, directors, delegats) no en formen part.
 */
export const AUTORITATS_GOVERN = ['President', 'Consellers', 'Portaveu del Govern'];

const MESOS = [
  'Gener',
  'Febrer',
  'Març',
  'Abril',
  'Maig',
  'Juny',
  'Juliol',
  'Agost',
  'Setembre',
  'Octubre',
  'Novembre',
  'Desembre',
];
const DIES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];

const dosXifres = (n: number) => String(n).padStart(2, '0');
const iso = (any: number, mes: number, dia: number) => `${any}-${dosXifres(mes)}-${dosXifres(dia)}`;

/** El mes passat, l'actual i el següent, comptats des de `avui` (AAAA-MM-DD). */
export function mesos(avui: string) {
  const [any, mes] = avui.split('-').map(Number) as [number, number];
  return [-1, 0, 1].map((salt) => {
    const d = new Date(Date.UTC(any, mes - 1 + salt, 1));
    return { any: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
  });
}

const darrerDia = (any: number, mes: number) => new Date(Date.UTC(any, mes, 0)).getUTCDate();

/** El primer dia del mes passat i l'últim del següent. */
export function finestra(avui: string) {
  const [primer, , darrer] = mesos(avui) as [
    { any: number; mes: number },
    unknown,
    { any: number; mes: number },
  ];
  return {
    des_de: iso(primer.any, primer.mes, 1),
    fins_a: iso(darrer.any, darrer.mes, darrerDia(darrer.any, darrer.mes)),
  };
}

type ActeSocrata = Record<string, unknown> & { id: string };

const OBLIGATORIS = ['titol', 'descripcio', 'hora_acte', 'data_acte', 'autoritat', 'departament'];
const OPCIONALS = ['adre_a', 'municipi'];

/** Socrata omet els camps buits: un camp obligatori que falta és un error de la font. */
function camps(f: ActeSocrata) {
  const llegits: Record<string, string> = {};
  for (const camp of [...OBLIGATORIS, ...OPCIONALS]) {
    const valor = f[camp];
    if (valor === undefined && OPCIONALS.includes(camp)) continue;
    if (typeof valor !== 'string')
      throw new SourceError(`A l'acte del Govern ${f.id} hi falta el camp ${camp}.`);
    llegits[camp] = valor;
  }
  return llegits;
}

/**
 * El dia a Catalunya, i no en UTC com `dia` de comun.ts: una actualització a les 00.30 és del dia
 * que comença.
 */
const diaACatalunya = (segons: number) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date(segons * 1000));

/** Els actes del Govern, del conjunt «Actes del Govern» de Dades obertes. */
export async function construirAgendaGovern(fetchImpl: Fetch, avui: string) {
  const { des_de: desDe, fins_a: finsA } = finestra(avui);
  const meta = await metadades(fetchImpl, ACTES_GOVERN);
  const limit = 5000;
  const autoritats = AUTORITATS_GOVERN.map((a) => `'${a}'`).join(',');
  const files = await getJson<ActeSocrata[]>(
    fetchImpl,
    `${SOCRATA}/resource/${ACTES_GOVERN}.json?${new URLSearchParams({
      $where: `data_acte >= '${desDe}' AND data_acte <= '${finsA}' AND autoritat in (${autoritats})`,
      // Amb un ordre total, dues consultes iguals tornen les files igual: es pot reproduir.
      $order: 'data_acte,hora_acte,id',
      $limit: String(limit),
    })}`,
  );
  if (files.length === limit) throw new SourceError('Els actes del Govern no caben en una pàgina.');

  // El conjunt repeteix algunes files senceres. Una còpia idèntica no és un altre acte; dues files
  // diferents amb el mateix identificador sí que són un error de la font.
  const perId = new Map<string, ActeSocrata>();
  for (const fila of files) {
    const vista = perId.get(fila.id);
    if (vista !== undefined && JSON.stringify(vista) !== JSON.stringify(fila))
      throw new SourceError(`Els actes del Govern tenen dues files diferents amb l'id ${fila.id}.`);
    perId.set(fila.id, fila);
  }

  const actes = [...perId.values()].map((fila) => {
    const f = camps(fila);
    const data = f.data_acte!.match(/^(\d{4}-\d{2}-\d{2})T00:00:00\.000$/)?.[1];
    const hora = f.hora_acte!.match(/^(\d{2}:\d{2}):00$/)?.[1];
    if (data === undefined || hora === undefined)
      throw new SourceError(`L'acte del Govern ${fila.id} té una data o una hora inesperada.`);
    if (!AUTORITATS_GOVERN.includes(f.autoritat!))
      throw new SourceError(`L'acte del Govern ${fila.id} és d'una autoritat que no s'ha demanat.`);
    return {
      id: fila.id,
      data,
      hora,
      titol: text(f.titol!),
      descripcio: text(f.descripcio!),
      ...(f.adre_a && { adreca: text(f.adre_a) }),
      ...(f.municipi && { municipi: text(f.municipi) }),
      autoritat: text(f.autoritat!),
      departament: text(f.departament!),
    };
  });

  return {
    font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
    url: `${SOCRATA}/d/${ACTES_GOVERN}`,
    data_dades: diaACatalunya(meta.rowsUpdatedAt),
    des_de: desDe,
    fins_a: finsA,
    autoritats: AUTORITATS_GOVERN,
    nota: 'Només els actes de les autoritats President, Consellers i Portaveu del Govern, tal com les classifica el conjunt. El conjunt publica els actes ja fets; els que encara no s’han fet no hi són. Els textos són els de la font, amb les entitats HTML convertides en caràcters i els espais i salts de línia seguits convertits en un sol espai.',
    actes,
  };
}

const urlAgenda = (categoria: string, any: number, mes: number) =>
  `${AGENDA_PARLAMENT}?${new URLSearchParams({
    p_categoria: categoria,
    p_hr: 'AGENDA',
    p_organ: '',
    p_mode: 'M',
    p_data: `01${dosXifres(mes)}${any}`,
  })}`;

/** Les categories del desplegable de l'agenda, llevat de «Totes». */
export function llegirCategories(html: string) {
  const select = html.match(/<select[^>]*name="p_categoria"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  if (select === undefined)
    throw new SourceError("L'agenda del Parlament no té el desplegable de categories.");
  const categories = [...select.matchAll(/<option value="(\w*)"\s*>([^<]*)<\/option>/g)]
    .filter((m) => m[1] !== '')
    .map((m) => ({ codi: m[1]!, nom: text(m[2]!) }));
  if (categories.length === 0)
    throw new SourceError("L'agenda del Parlament no té cap categoria al desplegable.");
  return categories;
}

export type ActeParlament = {
  data: string;
  /** Sense hora quan l'acte comença en acabar-ne un altre: el Parlament ho diu a `detalls`. */
  hora?: string;
  titol: string;
  /** Els paràgrafs de l'acte, en l'ordre del web: el tipus de sessió, la sala, la retransmissió… */
  detalls: string[];
  enllacos: { text: string; url: string }[];
  /** Quan va aparèixer al web, segons el mateix web. */
  publicat?: string;
  /** Si el Parlament l'ha desconvocat, quan. */
  desconvocat?: string;
};

const dataDelWeb = (dma: string) => {
  const [d, m, a] = dma.split('/');
  return `${a}-${m}-${d}`;
};

/** Els actes d'un mes de l'agenda del Parlament (`p_mode=M`), en l'ordre del web. */
export function llegirAgendaParlament(
  html: string,
  url: string,
  any: number,
  mes: number,
): ActeParlament[] {
  comprovaCodificacio(html, url);
  const inici = html.indexOf('<h2 class="titol_caixa">');
  const final = html.indexOf('<div class="cerca_advan">', inici);
  if (inici === -1 || final === -1)
    throw new SourceError(`${url} no té la llista d'actes on s'esperava.`);
  const llista = html.slice(inici, final);
  const titol = llista.match(/^<h2 class="titol_caixa"><span>([^<]*)<\/span><\/h2>/)?.[1];
  if (titol !== `${MESOS[mes - 1]} de ${any}`)
    throw new SourceError(`${url} és l'agenda de «${titol}», no de ${MESOS[mes - 1]} de ${any}.`);

  const actes: ActeParlament[] = [];
  // Cada dia és un <h3> seguit de la taula dels seus actes.
  const dies = llista.split('<h3 class="sub_titol_caixa">').slice(1);
  for (const tros of dies) {
    const capcalera = tros.match(/^<span>(\p{L}+), (\d{1,2})<\/span><\/h3>/u);
    if (capcalera === null) throw new SourceError(`${url} té un dia amb una forma inesperada.`);
    const dia = Number(capcalera[2]);
    const data = iso(any, mes, dia);
    if (DIES[new Date(`${data}T12:00:00Z`).getUTCDay()] !== capcalera[1])
      throw new SourceError(`${url} diu que el ${data} és ${capcalera[1]}.`);

    // La icona de càmera de la cel·la de l'hora enllaça la portada del Canal Parlament, no el vídeo de
    // l'acte; el vídeo de l'acte, si n'hi ha, és a la llista d'enllaços.
    const files = [
      ...tros.matchAll(
        /<tr><th rowspan="2" class="hora_lloc" scope="row"><p>([^<]*)<\/p>(?:<a [\s\S]*?<\/a>)?<\/th><td><p><strong>([\s\S]*?)<\/strong><\/p><\/td><\/tr><tr><td class="tema_acte">([\s\S]*?)<\/td><\/tr>/g,
      ),
    ];
    // Si alguna fila no té la forma que es llegeix, es perdria un acte sense que ningú ho sabés.
    if (files.length !== (tros.match(/class="hora_lloc"/g) ?? []).length)
      throw new SourceError(`${url} té actes del ${data} amb una forma inesperada.`);

    for (const [, horaWeb, titolWeb, tema] of files as unknown as string[][]) {
      const hora = horaWeb!.match(/^(\d{2}:\d{2})h$/)?.[1];
      if (hora === undefined && horaWeb !== '&nbsp;' && horaWeb !== '')
        throw new SourceError(`${url} té un acte del ${data} amb l'hora «${horaWeb}».`);
      const enllacos = [...tema!.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => ({
        text: text(m[2]!),
        url: new URL(text(m[1]!), url).href,
      }));
      // Un enllaç o un paràgraf amb una altra forma es perdria sense que ningú ho sabés.
      if (enllacos.length !== (tema!.match(/<a /g) ?? []).length)
        throw new SourceError(`${url} té un enllaç del ${data} amb una forma inesperada.`);
      const acte: ActeParlament = {
        data,
        ...(hora && { hora }),
        titol: text(titolWeb!),
        detalls: [],
        enllacos,
      };
      const senseLlista = tema!.replace(/<ul class="llista_simple">[\s\S]*?<\/ul>/g, '');
      const paragrafs = [...senseLlista.matchAll(/<p>([\s\S]*?)<\/p>/g)];
      if (paragrafs.length !== (senseLlista.match(/<p[\s>]/g) ?? []).length)
        throw new SourceError(`${url} té un paràgraf del ${data} amb una forma inesperada.`);
      for (const [, paragraf] of paragrafs) {
        const nota = text(paragraf!).match(
          /^\((Aparició al web|Desconvocat\/ada): (\d\d\/\d\d\/\d{4})\)$/,
        );
        if (nota === null) acte.detalls.push(text(paragraf!));
        else if (nota[1] === 'Aparició al web') acte.publicat = dataDelWeb(nota[2]!);
        else acte.desconvocat = dataDelWeb(nota[2]!);
      }
      actes.push(acte);
    }
  }
  if (actes.length !== (llista.match(/class="hora_lloc"/g) ?? []).length)
    throw new SourceError(`${url} té actes fora de cap dia.`);
  return actes;
}

const pausa = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * L'agenda del Parlament. El web no diu la categoria de cada acte, però la deixa filtrar: per a cada
 * mes es llegeix l'agenda sencera i després la de cada categoria, i cada acte ha de sortir en una
 * sola categoria.
 */
export async function construirAgendaParlament(fetchImpl: Fetch, avui: string, pausaMs = 300) {
  let categories: { codi: string; nom: string }[] | undefined;
  const actes = [];
  let primera = true;
  const llegeix = async (categoria: string, any: number, mes: number) => {
    if (!primera) await pausa(pausaMs);
    primera = false;
    const url = urlAgenda(categoria, any, mes);
    const html = await getText(fetchImpl, url);
    return { html, actes: llegirAgendaParlament(html, url, any, mes) };
  };
  for (const { any, mes } of mesos(avui)) {
    const totes = await llegeix('', any, mes);
    if (categories === undefined) categories = llegirCategories(totes.html);
    const pendents = new Map<string, number>();
    for (const acte of totes.actes) {
      const clau = JSON.stringify(acte);
      pendents.set(clau, (pendents.get(clau) ?? 0) + 1);
    }
    const categoriaDe = new Map<string, string>();
    for (const categoria of categories) {
      for (const acte of (await llegeix(categoria.codi, any, mes)).actes) {
        const clau = JSON.stringify(acte);
        const queden = pendents.get(clau);
        if (queden === undefined || queden === 0)
          throw new SourceError(
            `L'acte «${acte.titol}» del ${acte.data} surt a ${categoria.nom} més vegades que a l'agenda sencera.`,
          );
        pendents.set(clau, queden - 1);
        const ja = categoriaDe.get(clau);
        if (ja !== undefined && ja !== categoria.nom)
          throw new SourceError(
            `L'acte «${acte.titol}» del ${acte.data} surt a ${ja} i a ${categoria.nom}.`,
          );
        categoriaDe.set(clau, categoria.nom);
      }
    }
    for (const acte of totes.actes) {
      const categoria = categoriaDe.get(JSON.stringify(acte));
      if (categoria === undefined || pendents.get(JSON.stringify(acte)) !== 0)
        throw new SourceError(
          `L'acte «${acte.titol}» del ${acte.data} no surt a cap categoria de l'agenda.`,
        );
      actes.push({ ...acte, categoria });
    }
  }
  return {
    font: 'Parlament de Catalunya: agenda parlamentària',
    url: AGENDA_PARLAMENT,
    data_consulta: avui,
    ...finestra(avui),
    categories: categories!.map((c) => c.nom),
    nota: `El Parlament no publica l’agenda en un format de dades: es llegeix del seu web, mes a mes. La categoria de cada acte és la del filtre del mateix web. Els textos són els del web, sense etiquetes HTML. L’avís legal (${AVIS_LEGAL_PARLAMENT}) en permet la reutilització si se’n cita la font, no se n’altera el sentit i no es presenta com una versió oficial ni avalada pel Parlament.`,
    actes,
  };
}

/** Les dues agendes. El Govern primer: l'ordre de les crides es reprodueix. */
export async function construirAgenda(fetchImpl: Fetch, avui: string, pausaMs: number) {
  return {
    govern: await construirAgendaGovern(fetchImpl, avui),
    parlament: await construirAgendaParlament(fetchImpl, avui, pausaMs),
  };
}
