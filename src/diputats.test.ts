// Pàgines sintètiques amb la forma de les fitxes del Parlament del 23/11/2026. Els noms i les xifres
// són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import {
  agendaUrl,
  anualitats,
  construirDiputats,
  llegirBiografia,
  llegirCarrecs,
  llegirDeclaracio,
  llegirEnllacosDeclaracions,
} from './diputats.ts';

const FITXA = 'https://www.parlament.cat/web/composicio/diputats-fitxa/index.html?p_codi=7';
const BASE = '/web/composicio/diputats-fitxa';

const declaracions = [
  ['Rendes anuals íntegres percebudes del Parlament', `${BASE}/rendes-anuals/index.html?p_codi=7`],
  ['Declaració de béns', `${BASE}/declaracions-bens/index.html?p_codi=7&p_legislatura=15`],
  [
    'Declaració de compromís amb les polítiques d&#039;igualtat del Parlament',
    `${BASE}/declaracions-igualtat/index.html?p_codi=7&p_legislatura=15`,
  ],
];

const fitxa = ({
  carrecs = '<li><a href="/web/composicio/comissions/informacio-comissio/index.html?p_codi=1">Comissió A (CA)</a>. Presidenta. Alta: 13.09.2024, BOPC, 44. <ul class="links_relacionats"><li><a href="/web/composicio/comissions/ponencies/index.html?p_tipus=PON&amp;p_codi=1">Ponència: Projecte de llei B</a>. . Alta: 02.04.2025.  Baixa 26.11.2025. </li></ul></li><li><a href="/web/composicio/intergrups/x.html?p_codi=2">Intergrup C</a>. . Alta: 10.04.2025, BOPC, 204. </li><li>Comissió D (CD)<ul class="links_relacionats"><li><a href="/web/p?p_codi=3">Ponència: Proposició de llei E</a>. . Alta: 11.06.2025. </li><li>Grup de Treball F. . Alta: 07.05.2026, BOPC, 486. </li></ul></li>',
  biografia = true,
  enllacos = declaracions,
} = {}) =>
  `<a name="filiacio"></a><h2 class="titol_caixa"><span>Filiació</span></h2>` +
  `<a name="carrecs"></a><h2 class="titol_caixa"><span>Càrrecs parlamentaris</span></h2><div class="fitxa_parlamentari"><ul class="llista_simple">${carrecs}</ul><p class="contingut_breu"><strong><a href="#">Més informació</a></strong></p></div>` +
  `<a name="activitat"></a><h2 class="titol_caixa"><span>Activitat</span></h2>` +
  (biografia
    ? `<a name="biografia"></a><h2 class="titol_caixa"><span>Dades personals - biografia</span><span class="text_normal text_mida_10"> <em>(Presentació: 24.08.2025)</em></span></h2><div class="fitxa_parlamentari"><p class="text"><h3 class="sub_titol_caixa"><span>Naixement i residència</span></h3> <p class="text">Vila A, 1980<BR>Vila B</p><br><h3 class="sub_titol_caixa"><span>Formació</span></h3> <p class="text">Estudis d&#039;exemple.</p><p class="text">Un altre paràgraf.</p><br></p></div>`
    : '') +
  `<a name="declaracio"></a><h2 class="titol_caixa"><span>Declaracions</span></h2><div><ul class="llista_simple llista_resaltada">${enllacos.map(([t, h]) => `<li><p class="contingut_breu"><strong><a title="${t}" href="${h}">${t}</a></strong></p></li>`).join('')}</ul></div></div> </td> <td valign="top" style="width:1%" id="cs_columna_dreta">`;

const pagina = (codi: string, cos: string) =>
  `<html><p>Tornar a la fitxa d'<a href="/web/composicio/diputats-fitxa/index.html?p_codi=${codi}#declaracio">Persona Exemple</a></span></p></div><a name="amunt"></a>${cos}</div> </td> <td valign="top" style="width:1%" id="cs_columna_dreta" name="cs_columna_dreta"></td></html>`;

const RENDES = `<h2 class="titol_caixa"><span>Rendes anuals íntegres percebudes del Parlament (06/03/2026)</span></h2><em>Abans d'acabar el primer trimestre es publiquen.</em><div class="relacio_elements"> <h3 class="subtitol">Anualitat 2025</h3> <table summary="x"> <thead> <tr> <th class="c">&nbsp; </th> <th class="c">Import </th> </tr> </thead> <tbody> <tr><td>Retribucions</td><td>0,00&nbsp;&euro;&nbsp;</td> </tr> <tr class="par"><td>Indemnització</td><td style="x">19.910,04&nbsp;&euro;&nbsp;</td> </tr> </tbody> </table> </div><div class="relacio_elements"><h4>Observacions</h4><dl><dd>Opta només per la indemnització.</dd></dl></div>`;

const BENS = `<h2 class="titol_caixa"><span>Declaració de béns (07/06/2024)</span></h2><div class="relacio_elements"><h3 class="sub_titol_caixa"><span>Béns immobles</span></h3><table summary="x"><thead><tr><th>Tipus</th><!--th></th--><th>Any d'adquisició <br> (aaaa)</th></tr></thead><tbody><tr><td>Habitatge&nbsp;</td><td>2007&nbsp;</td></tr></tbody></table></div><div class="relacio_elements"><dl><dt>Plans de pensions</dt><dd>Valor <em>Total:</em> 1.251,96&nbsp;&euro;</dd></dl></div><div class="relacio_elements"><h3 class="sub_titol_caixa"><span>Altres</span></h3><dl><dd>Primera línia<br>Segona línia</dd></dl><dl><dd></dd></dl><h4>Llista</h4><ul><li>Un element</li></ul></div>`;

test('els càrrecs surten amb el càrrec dins l’òrgan, les dates i el que hi va a sota', () => {
  assert.deepEqual(llegirCarrecs(fitxa(), FITXA), [
    {
      organ: 'Comissió A (CA)',
      url: 'https://www.parlament.cat/web/composicio/comissions/informacio-comissio/index.html?p_codi=1',
      carrec: 'Presidenta',
      alta: '2024-09-13',
      relacionats: [
        {
          organ: 'Ponència: Projecte de llei B',
          url: 'https://www.parlament.cat/web/composicio/comissions/ponencies/index.html?p_tipus=PON&p_codi=1',
          alta: '2025-04-02',
          baixa: '2025-11-26',
        },
      ],
    },
    {
      organ: 'Intergrup C',
      url: 'https://www.parlament.cat/web/composicio/intergrups/x.html?p_codi=2',
      alta: '2025-04-10',
    },
    {
      organ: 'Comissió D (CD)',
      relacionats: [
        {
          organ: 'Ponència: Proposició de llei E',
          url: 'https://www.parlament.cat/web/p?p_codi=3',
          alta: '2025-06-11',
        },
        { organ: 'Grup de Treball F', alta: '2026-05-07' },
      ],
    },
  ]);
});

test('un càrrec amb una altra forma atura la lectura', () => {
  const html = fitxa({ carrecs: '<li><a href="/x">Comissió A</a>. Des del 2024. </li>' });
  assert.throws(() => llegirCarrecs(html, FITXA), /càrrec amb una forma inesperada: Comissió A/);
  const buit = fitxa({ carrecs: '<li>Comissió A</li>' });
  assert.throws(() => llegirCarrecs(buit, FITXA), /forma inesperada: Comissió A/);
  const sense = fitxa({ carrecs: '<li><strong>Comissió A</strong></li>' });
  assert.throws(() => llegirCarrecs(sense, FITXA), /forma inesperada/);
});

test('la biografia surt per apartats, una línia per salt de línia', () => {
  assert.deepEqual(llegirBiografia(fitxa(), FITXA), {
    data: { que: 'Presentació', dia: '2025-08-24' },
    apartats: [
      { titol: 'Naixement i residència', linies: ['Vila A, 1980', 'Vila B'] },
      { titol: 'Formació', linies: ["Estudis d'exemple.", 'Un altre paràgraf.'] },
    ],
  });
  assert.equal(llegirBiografia(fitxa({ biografia: false }), FITXA), undefined);
  const solt = fitxa().replace('<p class="text">Un altre paràgraf.</p>', 'Un text solt.');
  assert.throws(() => llegirBiografia(solt, FITXA), /forma inesperada/);
});

test('una declaració que no es coneix atura la lectura', () => {
  const html = fitxa({ enllacos: [['Nova', `${BASE}/declaracions-noves/index.html?p_codi=7`]] });
  assert.throws(() => llegirEnllacosDeclaracions(html, FITXA), /no es coneix/);
});

test('una declaració es llegeix en blocs, en l’ordre de la pàgina', () => {
  const url = 'https://www.parlament.cat/b';
  assert.deepEqual(llegirDeclaracio(pagina('7', BENS), url, '7'), {
    titol: 'Declaració de béns',
    data: '2024-06-07',
    url,
    blocs: [
      { titol: 'Béns immobles' },
      { taula: { columnes: ['Tipus', "Any d'adquisició (aaaa)"], files: [['Habitatge', '2007']] } },
      { pregunta: 'Plans de pensions' },
      { text: ['Valor Total: 1.251,96 €'] },
      { titol: 'Altres' },
      { text: ['Primera línia', 'Segona línia'] },
      { titol: 'Llista' },
      { text: ['Un element'] },
    ],
  });
});

test('una declaració d’una altra persona o amb etiquetes noves atura la lectura', () => {
  assert.throws(() => llegirDeclaracio(pagina('8', BENS), 'u', '7'), /no és una declaració/);
  const nova = BENS.replace('<ul><li>Un element</li></ul>', '<ol><li>Un element</li></ol>');
  assert.throws(() => llegirDeclaracio(pagina('7', nova), 'u', '7'), /<ol>/);
});

test('una declaració sense dades dona l’avís del Parlament', () => {
  const cos =
    '<h2 class="titol_caixa"><span>Declaració de béns</span></h2><div class="relacio_elements"><p><img align="absmiddle" alt="Imatge nformació" src="/css/sedu/img/missatge_info_32.png">No hi ha dades <strong>de moment</strong></p></div>';
  assert.deepEqual(llegirDeclaracio(pagina('7', cos), 'u', '7').blocs, [
    { avis: 'No hi ha dades de moment' },
  ]);
});

test('les rendes donen els imports de cada any, també un zero que la font publica', () => {
  const rendes = llegirDeclaracio(pagina('7', RENDES), 'u', '7');
  assert.equal(rendes.data, '2026-03-06');
  assert.deepEqual(anualitats(rendes), [
    {
      any: 2025,
      conceptes: [
        { concepte: 'Retribucions', import: 0 },
        { concepte: 'Indemnització', import: 19910.04 },
      ],
    },
  ]);
  assert.deepEqual(rendes.blocs[0], { text: ["Abans d'acabar el primer trimestre es publiquen."] });
  assert.deepEqual(rendes.blocs.at(-1), { text: ['Opta només per la indemnització.'] });
  const filaRara = RENDES.replace('</td> </tr> </tbody>', '</td> </tbody>');
  assert.throws(
    () => llegirDeclaracio(pagina('7', filaRara), 'u', '7'),
    /files que no es llegeixen/,
  );
  const senseTaula = RENDES.replace(/<table[\s\S]*<\/table>/, '');
  assert.throws(() => anualitats(llegirDeclaracio(pagina('7', senseTaula), 'u', '7')), /taula/);
});

const agenda = (titolMes: string) =>
  `<html><h2 class="titol_caixa"><span>Seleccioneu el tipus de vista</span></h2><div class="ccentral"><h2 class="titol_caixa"><span>${titolMes}</span></h2><div class="bloc_contingut"><table class="taula_actes_agenda"><tbody></table><h3 class="sub_titol_caixa"><span>Dimarts, 24</span></h3><table class="taula_actes_agenda"><tbody><tr><th rowspan="2" class="hora_lloc" scope="row"><p>10:30h</p><p>11:15h</p></th><td><p><strong>Reunió amb una entitat</strong></p></td></tr><tr><td class="tema_acte"><p><strong>Grup d'interès:</strong> Entitat Exemple</p><p><em>(Aparició al web: 20/11/2026)</em></p></td></tr></tbody></table></div>\n<div class="cerca_advan"><h2>Cerca</h2></div></html>`;

test('cada persona té les declaracions, les rendes, els compromisos i l’agenda del mes', async () => {
  const demanades: string[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = String(input);
    demanades.push(url);
    if (url.includes('/rendes-anuals/')) return new Response(pagina('7', RENDES));
    if (url.includes('/declaracions-bens/')) return new Response(pagina('7', BENS));
    if (url === agendaUrl('7', 2026, 11)) return new Response(agenda('Novembre de 2026'));
    return new Response('', { status: 404 });
  };
  const dades = await construirDiputats(
    fetchImpl,
    [{ codi: '7', nom: 'Persona Exemple', url: FITXA, html: fitxa() }],
    '2026-11-23',
    0,
  );
  // Els compromisos només s'enllacen: no es demanen.
  assert.equal(demanades.length, 3);
  const [persona] = dades.diputats;
  assert.equal(persona!.rendes!.anualitats[0]!.conceptes[1]!.import, 19910.04);
  assert.deepEqual(
    persona!.declaracions.map((d) => d.titol),
    ['Declaració de béns'],
  );
  assert.deepEqual(persona!.compromisos, [
    {
      titol: "Declaració de compromís amb les polítiques d'igualtat del Parlament",
      url: `https://www.parlament.cat${BASE}/declaracions-igualtat/index.html?p_codi=7&p_legislatura=15`,
    },
  ]);
  const [acte] = persona!.agenda.actes;
  assert.deepEqual([acte!.hora, acte!.fins], ['10:30', '11:15']);
  assert.deepEqual(acte!.detalls, ["Grup d'interès: Entitat Exemple"]);
  assert.deepEqual(dades.agenda, { any: 2026, mes: 11 });
});

test('l’agenda d’un altre mes atura la lectura', async () => {
  const fetchImpl: Fetch = async (input) =>
    new Response(
      String(input).includes('/agenda/') ? agenda('Octubre de 2026') : pagina('7', RENDES),
    );
  const html = fitxa({ enllacos: [declaracions[0]!] });
  await assert.rejects(
    construirDiputats(fetchImpl, [{ codi: '7', nom: 'P', url: FITXA, html }], '2026-11-23', 0),
    /Octubre de 2026/,
  );
});

test('si cap fitxa no té càrrecs o declaracions, la fitxa ha canviat i s’atura la lectura', async () => {
  const fetchImpl: Fetch = async () => new Response(agenda('Novembre de 2026'));
  const llegeix = (html: string) =>
    construirDiputats(fetchImpl, [{ codi: '7', nom: 'P', url: FITXA, html }], '2026-11-23', 0);
  await assert.rejects(llegeix(fitxa({ enllacos: [] })), /Cap fitxa .* declaracions/);
  await assert.rejects(llegeix(fitxa({ carrecs: '', enllacos: [] })), /Cap fitxa .* càrrecs/);
});
