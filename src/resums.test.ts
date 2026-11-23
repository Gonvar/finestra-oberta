// Sessions i respostes sintètiques, amb la forma d'activitat.json i de l'API de Messages. Els títols
// són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import {
  BUITS,
  construirResums,
  empremta,
  entrada,
  INSTRUCCIONS,
  MODEL,
  pendents,
  ResumError,
  resumeix,
  type Sessio,
} from './resums.ts';

const sessio = (numero: number, acord = "S'aprova la Moció."): Sessio => ({
  numero,
  caracter: 'ordinària',
  data: '2026-11-04',
  url: `https://www.parlament.cat/acords?p_sessio=${numero}`,
  punts: [
    { ordre: 1, titol: 'Moció subsegüent a la interpel·lació al Govern sobre els trens', acord },
    { ordre: 2, titol: 'Preguntes al Govern', acord: '' },
  ],
});

const resposta = (text: string, stop_reason = 'end_turn') =>
  new Response(
    JSON.stringify({
      model: MODEL,
      stop_reason,
      content: [
        { type: 'thinking', thinking: '', signature: 'x' },
        { type: 'text', text },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

/** Un fetch fals que desa cada petició i respon amb `respon`. */
function api(respon: (cos: { messages: { content: string }[] }) => Response) {
  const peticions: { url: string; init: RequestInit; cos: Record<string, unknown> }[] = [];
  const fetchImpl: Fetch = async (input, init) => {
    const cos = JSON.parse(String(init!.body));
    peticions.push({ url: String(input), init: init!, cos });
    return respon(cos);
  };
  return { fetchImpl, peticions };
}

test("l'entrada només porta la sessió i els punts, amb l'acord tal com és", () => {
  assert.equal(
    entrada(sessio(7)),
    "Sessió 7 del Ple del Parlament de Catalunya, ordinària, del 04/11/2026.\n\nPunts de l'ordre del dia:\n" +
      "1. Moció subsegüent a la interpel·lació al Govern sobre els trens\n   Acord: S'aprova la Moció.\n" +
      '2. Preguntes al Govern\n   Acord: (sense acord)\n',
  );
});

test('demana el resum amb el model, les instruccions publicades i sense temperatura', async () => {
  const { fetchImpl, peticions } = api(() => resposta('El Ple va parlar dels trens.'));
  assert.deepEqual(await resumeix(fetchImpl, 'clau', sessio(7)), {
    model: MODEL,
    text: 'El Ple va parlar dels trens.',
  });
  const [p] = peticions;
  assert.equal(p!.url, 'https://api.anthropic.com/v1/messages');
  assert.equal((p!.init.headers as Record<string, string>)['x-api-key'], 'clau');
  assert.equal(p!.cos.model, MODEL);
  assert.equal(p!.cos.system, INSTRUCCIONS);
  assert.equal('temperature' in p!.cos, false);
  assert.deepEqual(p!.cos.messages, [{ role: 'user', content: entrada(sessio(7)) }]);
});

test('no accepta un resum que valora, que queda tallat o que no arriba', async () => {
  const casos: [Response, RegExp][] = [
    [resposta('Va ser una sessió històrica.'), /històric/],
    [resposta('Polèmica al Ple.'), /Polèmic/],
    [resposta('El Ple va', 'max_tokens'), /max_tokens/],
    [resposta('   '), /cap text/],
    [resposta('a'.repeat(2501)), /2501/],
    [new Response('{"error":{"type":"overloaded_error"}}', { status: 529 }), /529/],
    [new Response('{"res":1}', { status: 200 }), /forma esperada/],
    [new Response('<html>', { status: 200 }), /no ha respost bé/],
  ];
  for (const [r, missatge] of casos)
    await assert.rejects(
      resumeix(async () => r, 'clau', sessio(7)),
      (e: unknown) => e instanceof ResumError && missatge.test(e.message),
    );
});

test('no confon una paraula que conté una valoració amb la valoració', async () => {
  const text = 'Es va parlar de la prehistòria i de les històries dels museus.';
  assert.equal((await resumeix(async () => resposta(text), 'clau', sessio(7))).text, text);
});

test('reaprofita els resums vigents i només demana els de les sessions noves o canviades', async () => {
  const { fetchImpl, peticions } = api((cos) =>
    resposta(`Resum de: ${cos.messages[0]!.content.split(' del Ple')[0]}`),
  );
  const primera = await construirResums(
    fetchImpl,
    'clau',
    [sessio(2), sessio(1)],
    BUITS,
    '2026-11-04',
  );
  assert.equal(peticions.length, 2);
  assert.deepEqual(primera.errors, []);
  assert.deepEqual(primera.fitxer.resums[0], {
    sessio: 2,
    data: '2026-11-04',
    font: 'https://www.parlament.cat/acords?p_sessio=2',
    model: MODEL,
    generat: '2026-11-04',
    empremta: empremta(sessio(2)),
    text: 'Resum de: Sessió 2',
  });

  // La sessió 1 canvia d'acord i n'arriba una de nova: es tornen a demanar aquestes dues.
  const sessions = [sessio(3), sessio(2), sessio(1, 'Es rebutja.')];
  assert.equal(pendents(sessions, primera.fitxer).length, 2);
  const segona = await construirResums(fetchImpl, 'clau', sessions, primera.fitxer, '2026-11-05');
  assert.equal(peticions.length, 4);
  assert.deepEqual(
    segona.fitxer.resums.map((r) => [r.sessio, r.generat]),
    [
      [3, '2026-11-05'],
      [2, '2026-11-04'],
      [1, '2026-11-05'],
    ],
  );
  assert.equal(pendents(sessions, segona.fitxer).length, 0);
});

test('accepta una paraula de la llista si surt als punts oficials', async () => {
  const s = sessio(7);
  s.punts[0]!.titol = 'Proposició de llei de memòria històrica';
  const text = 'El Ple va aprovar la proposició de llei de memòria històrica.';
  assert.equal((await resumeix(async () => resposta(text), 'clau', s)).text, text);
  await assert.rejects(
    resumeix(async () => resposta('Una decisió històrica.'), 'clau', sessio(7)),
    /històrica/,
  );
});

test('un resum descartat no es torna a demanar fins que canvia la sessió; un error de l’API, sí', async () => {
  const { fetchImpl, peticions } = api((cos) => {
    const text = cos.messages[0]!.content;
    if (text.startsWith('Sessió 2 ')) return resposta('Un fracàs.');
    if (text.startsWith('Sessió 1 ')) return new Response('{}', { status: 529 });
    return resposta('El Ple va parlar dels trens.');
  });
  const sessions = [sessio(3), sessio(2), sessio(1)];
  const { fitxer, errors } = await construirResums(
    fetchImpl,
    'clau',
    sessions,
    BUITS,
    '2026-11-04',
  );
  assert.deepEqual(
    fitxer.resums.map((r) => r.sessio),
    [3],
  );
  assert.deepEqual(fitxer.sense_resum, [
    {
      sessio: 2,
      empremta: empremta(sessio(2)),
      motiu: 'El resum fa servir una paraula que jutja: «fracàs».',
    },
  ]);
  assert.deepEqual(
    errors.map((e) => e.sessio),
    [2, 1],
  );
  assert.equal(fitxer.instruccions, INSTRUCCIONS);
  assert.equal(fitxer.model, MODEL);

  // L'endemà només es torna a demanar la 1. Si la 2 canvia, també.
  assert.deepEqual(
    pendents(sessions, fitxer).map((s) => s.numero),
    [1],
  );
  peticions.length = 0;
  await construirResums(fetchImpl, 'clau', sessions, fitxer, '2026-11-05');
  assert.equal(peticions.length, 1);
  assert.deepEqual(
    pendents([sessio(2, 'Es rebutja.')], fitxer).map((s) => s.numero),
    [2],
  );
});

test('sense clau, publica els resums vigents i no crida l’API', async () => {
  const { fetchImpl, peticions } = api(() => resposta('El Ple va parlar dels trens.'));
  const ahir = await construirResums(fetchImpl, 'clau', [sessio(1)], BUITS, '2026-11-04');
  peticions.length = 0;
  const { fitxer, errors } = await construirResums(
    fetchImpl,
    undefined,
    [sessio(2), sessio(1)],
    ahir.fitxer,
    '2026-11-05',
  );
  assert.equal(peticions.length, 0);
  assert.deepEqual(fitxer.resums, ahir.fitxer.resums);
  assert.deepEqual(errors, [{ sessio: 2, missatge: 'Falta la clau de l’API.' }]);
  assert.deepEqual(fitxer.sense_resum, []);
});

test('un resum publicat que ja no passa les comprovacions es torna a demanar', () => {
  const publicat = {
    sessio: 1,
    data: '2026-11-04',
    font: sessio(1).url,
    model: MODEL,
    generat: '2026-11-04',
    empremta: empremta(sessio(1)),
    text: 'Una sessió polèmica.',
  };
  assert.deepEqual(
    pendents([sessio(1)], { ...BUITS, resums: [publicat] }).map((s) => s.numero),
    [1],
  );
});
