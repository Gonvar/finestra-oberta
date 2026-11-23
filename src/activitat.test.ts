// Pàgines i files sintètiques amb la forma de les del Parlament i de Dades obertes del 22/11/2026.
// Els títols i els números són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  construirActivitat,
  construirNormes,
  llegirAcords,
  llegirLlista,
  NORMATIVA,
  SESSIONS_ORGANS,
} from './activitat.ts';
import type { Fetch } from './comun.ts';

const BASE = 'https://www.parlament.cat/web/activitat-parlamentaria/sessions-organs';
const LLISTA = `${BASE}/sessions-tingudes/index.html?p_legislatura=15&p_codi=46`;
const acordsUrl = (n: number) =>
  `${BASE}/sessions-tingudes/acords-sessions/index.html?p_legislatura=15&p_codi=46&p_sessio=${n}`;

const index = `<nav><a href="/web/activitat-parlamentaria/sessions-organs/XIII-legislatura/index.html">Anterior</a></nav><ul class="pagina_llistat"><li><a href="/web/activitat-parlamentaria/sessions-organs/XV-legislatura/index.html" title="Vegeu XV legislatura">XV legislatura</a></li><li><a href="/web/activitat-parlamentaria/sessions-organs/XIII-legislatura/index.html" title="Vegeu XIII - XIV legislatura">XIII - XIV legislatura</a></li></ul>`;
const organs = `<li><h3> <a href="/web/activitat-parlamentaria/sessions-organs/sessions-tingudes/index.html?p_legislatura=15&amp;p_codi=46" title="Vegeu la informació de Ple del Parlament">Ple del Parlament</a></h3></li><li><h3> <a href="/web/activitat-parlamentaria/sessions-organs/sessions-tingudes/index.html?p_legislatura=15&amp;p_codi=1314" title="Vegeu la informació de Comissió d'Exemple">Comissió d'Exemple</a></h3></li>`;

const fila = (n: number, caracter: string, data: string) => `
  <tr>
    <th style="padding-left:1em;" scope="row">
      <span>Sessió núm. ${n}, ${caracter}</span>
    </th>
    <td>
      <span>${data} - 15:00h</span>
    </td>
    <td style="text-align:right;padding-right:2em;">
      <div class="color_blau"><span>
        <a title="Vegeu els acords de la Sessió núm. ${n}, ${caracter}" href="/web/activitat-parlamentaria/sessions-organs/sessions-tingudes/acords-sessions/index.html?p_legislatura=15&p_codi=46&p_sessio=${n}">Acords</a>`;

const llista = (pagina: number, de: number, files: string[]) =>
  `<table><tfoot><tr><td><div><p class="pagines_num">Pàgina ${pagina} de ${de}</p></div></td></tr></tfoot><tbody>${files.join('')}</tbody></table>`;

const punt = (ordre: number, titol: string, expedient: string, acord: string) => `<li>
  <strong class="punt_ordre">${ordre}</strong>
  <div>
    <p>${titol}</p>
    <p>Número d'expedient: <a target="_blank" title="Vegeu &quot;tramitació&quot;" href="https://www.parlament.cat/ext/f?p=siap-cerca:expedient:::::p15_num_expedient:${expedient}">${expedient}</a></p>    <p><i>${acord}</i></p>  </div>
</li>`;

const acords = (punts: string[], pagina = 1, pagines = 1) =>
  `<dl class="dades_convocatoria"><dt>Dia:</dt><dd>Dimecres, 4 de novembre de 2026</dd></dl><div class="paginacio pagines_top"><div><p class="pagines_num">Pàgina ${pagina} de ${pagines}</p></div></div><ul class="llista_numerada">${punts.join('')}</ul><div class="paginacio"><p class="pagines_num">Pàgina ${pagina} de ${pagines}</p></div>`;

test('la llista de sessions dona el número, el caràcter, la data, l’hora i els acords', () => {
  const html = llista(1, 2, [
    fila(3, 'ordinària', '04/11/2026'),
    fila(2, 'específica', '29/09/2026'),
  ]);
  assert.deepEqual(llegirLlista(html, 'u'), {
    pagines: 2,
    sessions: [
      { numero: 3, caracter: 'ordinària', data: '2026-11-04', hora: '15:00', url: acordsUrl(3) },
      { numero: 2, caracter: 'específica', data: '2026-09-29', hora: '15:00', url: acordsUrl(2) },
    ],
  });
});

test('la llista de sessions falla si una fila no es pot llegir', () => {
  const html = llista(1, 1, [
    fila(3, 'ordinària', '04/11/2026'),
    fila(2, 'ordinària', '2026-09-29'),
  ]);
  assert.throws(() => llegirLlista(html, 'u'), /2 sessions i se n'han pogut llegir 1/);
});

test('els acords conserven el text oficial i només donen el resultat quan és clar', () => {
  const { pagines, punts } = llegirAcords(
    acords([
      punt(1, 'Pregunta al Govern sobre l&#039;exemple', '310-00001/15', 'Se substancia.'),
      punt(2, 'Moció subsegüent sobre l’exemple', '302-00001/15', "S'aprova la Moció."),
      punt(3, 'Moció subsegüent sobre un altre exemple', '302-00002/15', 'Es rebutja.'),
      punt(
        4,
        'Proposició de llei d’exemple',
        '202-00001/15',
        "S'aprova l'esmena a la totalitat de devolució de la Proposició de llei. CET",
      ),
      punt(
        5,
        'Proposició de llei d’un altre exemple',
        '202-00002/15',
        "Es rebutja l'esmena a la totalitat. CET",
      ),
      punt(
        6,
        'Decret llei d’exemple',
        '203-00001/15',
        "Es convalida el Decret llei i se n'acorda la tramitació com a projecte de llei. CET",
      ),
      punt(
        7,
        'Proposició de llei d’exemple',
        '202-00003/15',
        "S'aprova la Llei. Comissió d'Exemple",
      ),
      punt(8, 'Moció subsegüent sobre l’exemple', '390-00001/15', ''),
      punt(9, 'Decret llei d’un altre exemple', '203-00002/15', 'Es deroga el Decret llei.'),
    ]),
    'u',
  );
  assert.deepEqual(punts[0], {
    ordre: 1,
    titol: "Pregunta al Govern sobre l'exemple",
    expedient: '310-00001/15',
    url_expedient:
      'https://www.parlament.cat/ext/f?p=siap-cerca:expedient:::::p15_num_expedient:310-00001/15',
    acord: 'Se substancia.',
    resultat: null,
  });
  assert.deepEqual(
    punts.map((p) => p.resultat),
    [null, 'aprovat', 'rebutjat', null, null, 'convalidat', 'aprovat', null, 'derogat'],
  );
  assert.equal(punts[6]!.acord, "S'aprova la Llei. Comissió d'Exemple");
  assert.equal(pagines, 1);
});

test('els acords fallen si un punt no té la forma esperada', () => {
  const sense = acords([
    punt(1, 'T', '302-00001/15', 'Es rebutja.').replace(/<p>Número[\s\S]*?<\/p>/, ''),
  ]);
  assert.throws(() => llegirAcords(sense, 'u'), /forma esperada/);
});

test('els acords fallen si no es llegeixen tots els punts numerats o si no n’hi ha cap', () => {
  const tallada = acords([punt(1, 'T', '302-00001/15', 'Es rebutja.')]).replace(
    '</ul>',
    '</ul><ul><li><strong class="punt_ordre">2</strong></li></ul>',
  );
  assert.throws(() => llegirAcords(tallada, 'u'), /té 2 punts i se n'han trobat 1/);
  assert.throws(() => llegirAcords(acords([]), 'u'), /té 0 punts/);
});

test('l’activitat llegeix totes les pàgines, desa una vegada les sessions repetides i llegeix les normes', async () => {
  const consultes: string[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = String(input);
    consultes.push(url);
    if (url === SESSIONS_ORGANS) return new Response(index);
    if (url === `${BASE}/XV-legislatura/index.html`) return new Response(organs);
    if (url === LLISTA)
      return new Response(
        llista(1, 2, [
          fila(3, 'ordinària', '04/11/2026'),
          fila(2, 'ordinària', '20/10/2026'),
          fila(2, 'ordinària', '20/10/2026'),
        ]),
      );
    if (url === `${LLISTA}&p_pagina=2`)
      return new Response(llista(2, 2, [fila(1, 'constitutiva', '10/06/2024')]));
    if (url === acordsUrl(3))
      return new Response(acords([punt(1, 'Punt 3', '302-00003/15', 'Es rebutja.')], 1, 2));
    if (url === `${acordsUrl(3)}&p_pagina=2`)
      return new Response(acords([punt(2, 'Punt 3b', '302-00004/15', "S'aprova la Moció.")], 2, 2));
    for (const n of [1, 2])
      if (url === acordsUrl(n))
        return new Response(acords([punt(1, `Punt ${n}`, `302-0000${n}/15`, 'Es rebutja.')]));
    if (url.endsWith(`/api/views/${NORMATIVA}.json`))
      return Response.json({
        name: 'Normativa',
        attribution: 'Generalitat',
        rowsUpdatedAt: 1795392000,
      });
    if (url.includes(`/resource/${NORMATIVA}.json`))
      return Response.json([
        {
          t_tol_de_la_norma: 'Llei 1/2026, de 2 de gener, d’exemple ',
          rang_de_norma: 'Llei',
          data_del_document: '2026-01-02T00:00:00.000',
          data_de_publicaci_del_diari: '2026-01-05T00:00:00.000',
          n_mero_de_diari: '9000',
          vig_ncia_de_la_norma: 'Vigent',
          url_ltima_versi_format_html: {
            url: 'https://portaljuridic.gencat.cat/eli/es-ct/l/2026/01/02/1',
          },
        },
      ]);
    return new Response('', { status: 404 });
  };
  const activitat = await construirActivitat(fetchImpl, '2026-11-22', 0);
  assert.equal(activitat.legislatura, 15);
  assert.deepEqual(
    activitat.sessions.map((s) => s.numero),
    [3, 2, 1],
  );
  assert.deepEqual(
    activitat.sessions[0]!.punts.map((p) => p.resultat),
    ['rebutjat', 'aprovat'],
  );
  assert.equal(consultes.filter((u) => u === acordsUrl(2)).length, 1);
  const normes = consultes.find((u) => u.includes(`/resource/${NORMATIVA}.json`))!;
  assert.match(
    new URL(normes).searchParams.get('$where')!,
    /'Llei','Decret llei'.*>= '2024-06-10'/,
  );
  assert.deepEqual(activitat.normes.normes[0], {
    titol: 'Llei 1/2026, de 2 de gener, d’exemple',
    rang: 'Llei',
    data: '2026-01-02',
    data_publicacio: '2026-01-05',
    dogc: '9000',
    vigencia: 'Vigent',
    url: 'https://portaljuridic.gencat.cat/eli/es-ct/l/2026/01/02/1',
  });
  assert.equal(activitat.normes.data_dades, '2026-11-23');
});

test('l’activitat falla si una sessió surt dues vegades amb dades diferents', async () => {
  const fetchImpl: Fetch = async (input) => {
    const url = String(input);
    if (url === SESSIONS_ORGANS) return new Response(index);
    if (url === `${BASE}/XV-legislatura/index.html`) return new Response(organs);
    if (url === LLISTA)
      return new Response(
        llista(1, 1, [fila(2, 'ordinària', '21/10/2026'), fila(2, 'ordinària', '20/10/2026')]),
      );
    return new Response('', { status: 404 });
  };
  await assert.rejects(construirActivitat(fetchImpl, '2026-11-22', 0), /dades diferents/);
});

test('les normes fallen si a una fila li falta un camp', async () => {
  const fetchImpl: Fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(`/api/views/${NORMATIVA}.json`))
      return Response.json({ name: 'Normativa', attribution: 'Generalitat', rowsUpdatedAt: 1 });
    return Response.json([
      {
        t_tol_de_la_norma: 'Llei 1/2026, d’exemple',
        rang_de_norma: 'Llei',
        data_del_document: '2026-01-02T00:00:00.000',
        data_de_publicaci_del_diari: '2026-01-05T00:00:00.000',
        n_mero_de_diari: '9000',
        url_ltima_versi_format_html: {
          url: 'https://portaljuridic.gencat.cat/eli/es-ct/l/2026/01/02/1',
        },
      },
    ]);
  };
  await assert.rejects(construirNormes(fetchImpl, '2024-06-10'), /no té vig_ncia_de_la_norma/);
});
