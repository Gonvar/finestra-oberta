// Dades sintètiques amb la forma de les respostes de Socrata, no captures reals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { cercarConjunt, consultarDades, veureConjunt } from './dadesobertes.ts';

function fake(status: number, body: unknown) {
  const urls: string[] = [];
  const fetchImpl: Fetch = async (input) => {
    urls.push(String(input));
    return Response.json(body, { status });
  };
  return { fetchImpl, urls };
}

test('la cerca es limita al portal de la Generalitat i dona la data de les dades', async () => {
  const { fetchImpl, urls } = fake(200, {
    resultSetSize: 1,
    results: [
      {
        resource: {
          id: 'abcd-1234',
          name: 'Accidents',
          description: 'Des de 2010.',
          attribution: 'Interior',
          data_updated_at: '2024-12-05T08:36:54.000Z',
        },
        classification: {
          domain_category: 'Transport',
          domain_metadata: [
            { key: "Freqüència-d'actualització_Freqüència-d'actualització", value: 'Anual' },
          ],
        },
        permalink: 'https://analisi.transparenciacatalunya.cat/d/abcd-1234',
      },
    ],
  });
  const { conjunts } = await cercarConjunt(fetchImpl, 'accidents');
  assert.match(urls[0]!, /domains=analisi\.transparenciacatalunya\.cat/);
  assert.equal(conjunts[0]!.dades_actualitzades, '2024-12-05');
  assert.equal(conjunts[0]!.frequencia, 'Anual');
});

test('les columnes de text porten els seus valors freqüents; les altres, no', async () => {
  const { fetchImpl } = fake(200, {
    name: 'Accidents',
    rowsUpdatedAt: 1733387814,
    columns: [
      {
        fieldName: 'nomcom',
        name: 'nomCom',
        dataTypeName: 'text',
        cachedContents: { cardinality: '43', top: [{ item: 'Barcelonès' }] },
      },
      {
        fieldName: 'dat',
        name: 'dat',
        dataTypeName: 'calendar_date',
        cachedContents: {
          smallest: '2010-01-01',
          largest: '2023-12-31',
          top: [{ item: '2012-03-30' }],
        },
      },
    ],
  });
  const result = await veureConjunt(fetchImpl, 'abcd-1234');
  assert.equal(result.dades_actualitzades, '2024-12-05');
  assert.deepEqual(result.columnes[0]!.valors_frequents, ['Barcelonès']);
  assert.equal(result.columnes[1]!.valors_frequents, undefined);
  assert.equal(result.columnes[1]!.maxim, '2023-12-31');
});

test('passa la consulta com a SoQL i avisa quan arriba al límit', async () => {
  const { fetchImpl, urls } = fake(200, [{ nomcom: 'Osona', n: '12' }]);
  const result = await consultarDades(fetchImpl, 'abcd-1234', {
    select: 'nomcom, count(*) as n',
    where: 'any = 2023',
    group: 'nomcom',
    limit: 1,
  });
  const params = new URL(urls[0]!).searchParams;
  assert.equal(params.get('$select'), 'nomcom, count(*) as n');
  assert.equal(params.get('$where'), 'any = 2023');
  assert.equal(params.get('$limit'), '1');
  assert.equal(params.has('$offset'), false);
  assert.match(result.avis!, /pot haver-n'hi més/);
});

test('un zero amb un filtre de text avisa que potser el text no està ben escrit', async () => {
  const { fetchImpl } = fake(200, [{ n: '0' }]);
  const result = await consultarDades(fetchImpl, 'abcd-1234', {
    select: 'count(*) as n',
    where: "nomcom = 'osona'",
    limit: 100,
  });
  assert.match(result.avis!, /s'escriuen exactament/);
  const numeric = await consultarDades(fake(200, [{ n: '0' }]).fetchImpl, 'abcd-1234', {
    select: 'count(*) as n',
    where: 'any = 1900',
    limit: 100,
  });
  assert.equal(numeric.avis, undefined);
});

test("un error de la consulta s'explica sense repetir la consulta interna", async () => {
  const { fetchImpl } = fake(400, {
    message:
      'query.soql.no-such-column; No such column: nope; position: Map(row -> 1, line -> "SELECT `any`, …")',
  });
  await assert.rejects(
    consultarDades(fetchImpl, 'abcd-1234', { where: 'nope = 1', limit: 100 }),
    (error: Error) =>
      error.message ===
      'La consulta SoQL no és vàlida: query.soql.no-such-column; No such column: nope',
  );
});

test('un conjunt que no existeix es diu com a tal', async () => {
  const { fetchImpl } = fake(404, { code: 'not_found' });
  await assert.rejects(veureConjunt(fetchImpl, 'zzzz-zzzz'), /No hi ha cap conjunt «zzzz-zzzz»/);
});
