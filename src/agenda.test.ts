import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  construirAgendaGovern,
  construirAgendaParlament,
  finestra,
  llegirAgendaParlament,
  mesos,
} from './agenda.ts';
import { SourceError, type Fetch } from './comun.ts';

const URL_PROVA = 'https://www.parlament.cat/web/actualitat/agenda/index.html';

test('agafa el mes passat, l’actual i el següent, també en canviar d’any', () => {
  assert.deepEqual(mesos('2026-12-05'), [
    { any: 2026, mes: 11 },
    { any: 2026, mes: 12 },
    { any: 2027, mes: 1 },
  ]);
  assert.deepEqual(finestra('2026-01-31'), { des_de: '2025-12-01', fins_a: '2026-02-28' });
});

// Dades sintètiques amb la forma de l'agenda del web del Parlament.
type ActeProva = { hora: string; titol: string; tema: string; video?: boolean };

const fila = ({ hora, titol, tema, video }: ActeProva) =>
  `<tr><th rowspan="2" class="hora_lloc" scope="row"><p>${hora}</p>${video ? '<a class="fa fa-video-camera" title="Canal" href="https://www.parlament.cat/ext/f?p=700"><p class="ocultar">Canal</p></a>' : ''}</th><td><p><strong>${titol}</strong></p></td></tr><tr><td class="tema_acte">${tema}</td></tr>`;

function pagina(titolMes: string, dies: [string, ActeProva[]][], categories = true) {
  const desplegable = categories
    ? '<select class="camp_cercador" id="p_categoria" name="p_categoria" title="x" ><option value="" >Totes</option><option value="SESSIO" >Sessions dels òrgans</option><option value="ACTE_INSTITUCIONAL" >Actes institucionals</option></select>'
    : '';
  const cos = dies
    .map(
      ([dia, actes]) =>
        `<h3 class="sub_titol_caixa"><span>${dia}</span></h3><table class="taula_actes_agenda"><tbody>${actes.map(fila).join('')}</tbody></table>`,
    )
    .join('');
  return `<html><form>${desplegable}</form><div class="ccentral"><h2 class="titol_caixa"><span>${titolMes}</span></h2><div class="bloc_contingut"><table class="taula_actes_agenda"><tbody></table>${cos}</div>\n<div class="cerca_advan"><h2>Cerca</h2></div></html>`;
}

const PLE: ActeProva = {
  hora: '10:00h',
  titol: 'Ple del Parlament',
  tema: '<p>Sessió ordinària</p><p>Saló de sessions</p><p>Emissió en directe</p><ul class="llista_simple"><li class=""><a href="/web/actualitat/ordre-dia/index.html?p_od0=1" title="Vegeu &quot;Ordre del dia&quot;" target="_self">Ordre del dia</a></li></ul><p><em>(Aparició al web: 20/11/2026)</em></p>',
  video: true,
};
const MESA: ActeProva = {
  hora: '&nbsp;',
  titol: 'Mesa del Parlament',
  tema: '<p><em>En acabar la sessió del Ple</em></p><p>Sessió ordinària</p><p><em>(Aparició al web: 20/11/2026)</em></p>',
};
const VISITA: ActeProva = {
  hora: '18:00h',
  titol: 'La presidència assisteix a l&#39;acte',
  tema: '<p>Girona</p><p><em>(Desconvocat/ada: 21/11/2026)</em></p>',
};

test('llegeix cada acte amb la data, l’hora, els detalls, els enllaços i si s’ha desconvocat', () => {
  const html = pagina('Novembre de 2026', [
    ['Dimarts, 24', [PLE, MESA]],
    ['Dimecres, 25', [VISITA]],
  ]);
  assert.deepEqual(llegirAgendaParlament(html, URL_PROVA, 2026, 11), [
    {
      data: '2026-11-24',
      hora: '10:00',
      titol: 'Ple del Parlament',
      detalls: ['Sessió ordinària', 'Saló de sessions', 'Emissió en directe'],
      enllacos: [
        {
          text: 'Ordre del dia',
          url: 'https://www.parlament.cat/web/actualitat/ordre-dia/index.html?p_od0=1',
        },
      ],
      publicat: '2026-11-20',
    },
    {
      data: '2026-11-24',
      titol: 'Mesa del Parlament',
      detalls: ['En acabar la sessió del Ple', 'Sessió ordinària'],
      enllacos: [],
      publicat: '2026-11-20',
    },
    {
      data: '2026-11-25',
      hora: '18:00',
      titol: "La presidència assisteix a l'acte",
      detalls: ['Girona'],
      enllacos: [],
      desconvocat: '2026-11-21',
    },
  ]);
});

test('s’atura si l’agenda és d’un altre mes, si el dia no quadra o si un acte no es pot llegir', () => {
  assert.throws(
    () => llegirAgendaParlament(pagina('Octubre de 2026', []), URL_PROVA, 2026, 11),
    SourceError,
  );
  assert.throws(
    () =>
      llegirAgendaParlament(
        pagina('Novembre de 2026', [['Dilluns, 24', [PLE]]]),
        URL_PROVA,
        2026,
        11,
      ),
    /diu que el 2026-11-24 és Dilluns/,
  );
  const trencat = pagina('Novembre de 2026', [['Dimarts, 24', [PLE]]]).replace(
    '<td><p><strong>',
    '<td><p><b>',
  );
  assert.throws(() => llegirAgendaParlament(trencat, URL_PROVA, 2026, 11), /forma inesperada/);
  assert.throws(
    () =>
      llegirAgendaParlament(
        pagina('Novembre de 2026', [['Dimarts, 24', [{ ...PLE, hora: 'matí' }]]]),
        URL_PROVA,
        2026,
        11,
      ),
    /l'hora «matí»/,
  );
});

/** Un fetch fals que serveix una pàgina per a cada categoria i mes, i apunta què se li demana. */
function webParlament(perCategoria: Record<string, [string, ActeProva[]][]>) {
  const demanades: string[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = new URL(String(input));
    demanades.push(`${url.searchParams.get('p_categoria')}:${url.searchParams.get('p_data')}`);
    const mes = Number(url.searchParams.get('p_data')!.slice(2, 4));
    const titol = { 10: 'Octubre', 11: 'Novembre', 12: 'Desembre' }[mes];
    const dies = mes === 11 ? perCategoria[url.searchParams.get('p_categoria')!]! : [];
    return new Response(pagina(`${titol} de 2026`, dies));
  };
  return { fetchImpl, demanades };
}

test('dona a cada acte del Parlament la categoria del filtre del web', async () => {
  const { fetchImpl, demanades } = webParlament({
    '': [
      ['Dimarts, 24', [PLE, MESA]],
      ['Dimecres, 25', [VISITA]],
    ],
    SESSIO: [['Dimarts, 24', [PLE, MESA]]],
    ACTE_INSTITUCIONAL: [['Dimecres, 25', [VISITA]]],
  });
  const agenda = await construirAgendaParlament(fetchImpl, '2026-11-22', 0);
  assert.deepEqual(
    agenda.actes.map((a) => [a.titol, a.categoria]),
    [
      ['Ple del Parlament', 'Sessions dels òrgans'],
      ['Mesa del Parlament', 'Sessions dels òrgans'],
      ["La presidència assisteix a l'acte", 'Actes institucionals'],
    ],
  );
  assert.deepEqual(agenda.categories, ['Sessions dels òrgans', 'Actes institucionals']);
  assert.equal(agenda.des_de, '2026-10-01');
  assert.equal(agenda.fins_a, '2026-12-31');
  assert.deepEqual(demanades.slice(0, 3), [
    ':01102026',
    'SESSIO:01102026',
    'ACTE_INSTITUCIONAL:01102026',
  ]);
  assert.equal(demanades.length, 9);
});

test('s’atura si un acte no surt a cap categoria o en surt a dues', async () => {
  const sensa = webParlament({
    '': [['Dimarts, 24', [PLE, MESA]]],
    SESSIO: [['Dimarts, 24', [PLE]]],
    ACTE_INSTITUCIONAL: [],
  });
  await assert.rejects(
    construirAgendaParlament(sensa.fetchImpl, '2026-11-22', 0),
    /Mesa del Parlament.*no surt a cap categoria/,
  );
  const dues = webParlament({
    '': [['Dimarts, 24', [PLE]]],
    SESSIO: [['Dimarts, 24', [PLE]]],
    ACTE_INSTITUCIONAL: [['Dimarts, 24', [PLE]]],
  });
  await assert.rejects(construirAgendaParlament(dues.fetchImpl, '2026-11-22', 0), SourceError);
});

// Dades sintètiques amb la forma del conjunt «Actes del Govern» de Dades obertes.
const META = {
  name: 'Actes del Govern',
  attribution: 'Direcció General de Comunicació',
  rowsUpdatedAt: 1795300000,
};
const acteGovern = (id: string, extra: Record<string, string> = {}) => ({
  id,
  titol: 'La consellera visita l&quot;escola&quot;',
  descripcio: 'Descripció&nbsp;de l’acte.',
  hora_acte: '10:30:00',
  data_acte: '2026-11-20T00:00:00.000',
  adre_a: 'Plaça Major, 1',
  municipi: 'Vic',
  comarca: 'Osona',
  territori: 'Catalunya central',
  autoritat: 'Consellers',
  departament: 'Cultura',
  ...extra,
});

function socrata(files: unknown[]) {
  const demanades: URL[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = new URL(String(input));
    demanades.push(url);
    return Response.json(url.pathname.startsWith('/api/views/') ? META : files);
  };
  return { fetchImpl, demanades };
}

test('demana els actes del Govern de la finestra i treu les files repetides senceres', async () => {
  const { fetchImpl, demanades } = socrata([acteGovern('1'), acteGovern('1'), acteGovern('2')]);
  const agenda = await construirAgendaGovern(fetchImpl, '2026-11-22');
  assert.equal(
    demanades[1]!.searchParams.get('$where'),
    "data_acte >= '2026-10-01' AND data_acte <= '2026-12-31' AND autoritat in ('President','Consellers','Portaveu del Govern')",
  );
  assert.deepEqual(agenda.actes, [
    {
      id: '1',
      data: '2026-11-20',
      hora: '10:30',
      titol: 'La consellera visita l"escola"',
      descripcio: 'Descripció de l’acte.',
      adreca: 'Plaça Major, 1',
      municipi: 'Vic',
      autoritat: 'Consellers',
      departament: 'Cultura',
    },
    { ...agenda.actes[0]!, id: '2' },
  ]);
  assert.equal(agenda.data_dades, '2026-11-21');
  assert.equal(
    agenda.font,
    'Dades obertes de Catalunya: Actes del Govern (Direcció General de Comunicació)',
  );
});

test('s’atura si dues files diferents tenen el mateix id o si una hora no té la forma esperada', async () => {
  await assert.rejects(
    construirAgendaGovern(
      socrata([acteGovern('1'), acteGovern('1', { municipi: 'Reus' })]).fetchImpl,
      '2026-11-22',
    ),
    /dues files diferents amb l'id 1/,
  );
  await assert.rejects(
    construirAgendaGovern(socrata([acteGovern('1', { hora_acte: '' })]).fetchImpl, '2026-11-22'),
    /data o una hora inesperada/,
  );
  await assert.rejects(
    construirAgendaGovern(
      socrata(Array.from({ length: 5000 }, (_, i) => acteGovern(String(i)))).fetchImpl,
      '2026-11-22',
    ),
    /no caben en una pàgina/,
  );
});

test('s’atura si un enllaç o un paràgraf d’un acte no es pot llegir', () => {
  const ambEnllac = (tema: string) =>
    pagina('Novembre de 2026', [['Dimarts, 24', [{ ...PLE, tema }]]]);
  assert.throws(
    () =>
      llegirAgendaParlament(
        ambEnllac('<ul class="llista_simple"><li><a href="/v"><span>Vídeo</span></a></li></ul>'),
        URL_PROVA,
        2026,
        11,
      ),
    /enllaç del 2026-11-24/,
  );
  assert.throws(
    () => llegirAgendaParlament(ambEnllac('<p class="sala">Sala 1</p>'), URL_PROVA, 2026, 11),
    /paràgraf del 2026-11-24/,
  );
});

test('resol els enllaços relatius des de la pàgina i accepta l’hora buida', () => {
  const [acte] = llegirAgendaParlament(
    pagina('Novembre de 2026', [
      [
        'Dimarts, 24',
        [
          {
            ...PLE,
            hora: '',
            tema: '<ul class="llista_simple"><li><a href="programa.pdf">Programa</a></li></ul>',
          },
        ],
      ],
    ]),
    URL_PROVA,
    2026,
    11,
  );
  assert.equal(acte!.hora, undefined);
  assert.deepEqual(acte!.enllacos, [
    { text: 'Programa', url: 'https://www.parlament.cat/web/actualitat/agenda/programa.pdf' },
  ]);
});

test('llegeix les entitats numèriques i s’atura si a un acte del Govern li falta un camp', async () => {
  const { fetchImpl } = socrata([acteGovern('1', { titol: 'L&#8217;acte &#x2014; Vic' })]);
  assert.equal(
    (await construirAgendaGovern(fetchImpl, '2026-11-22')).actes[0]!.titol,
    'L’acte — Vic',
  );
  const { descripcio: _, ...senseDescripcio } = acteGovern('2');
  await assert.rejects(
    construirAgendaGovern(socrata([senseDescripcio]).fetchImpl, '2026-11-22'),
    /hi falta el camp descripcio/,
  );
});
