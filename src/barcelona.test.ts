// Adaptat de les proves de samuelcorsan/reforma-digital#265 (MIT). Respostes amb la forma de l'API
// CKAN del portal, retallades de les reals del 22/11/2026 i sense dades personals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consultarDades, cercarConjunt, veureConjunt } from './barcelona.ts';
import type { Fetch } from './comun.ts';

/** Un `fetch` que sempre respon el mateix i recorda les URL demanades. */
function fake(body: unknown, status = 200) {
  const urls: URL[] = [];
  const fetchImpl: Fetch = async (input) => {
    urls.push(new URL(String(input)));
    return Response.json(body, { status });
  };
  return { fetchImpl, urls };
}

const resource = (id: string, name: string, created: string, datastore_active = true) => ({
  id,
  name,
  format: 'CSV',
  created,
  datastore_active,
});

const catalog = {
  success: true,
  result: {
    count: 3,
    results: [
      {
        name: 'pad_mdbas_sexe',
        title: 'Population by neighborhood',
        title_translated: { ca: 'Població per barri', es: 'Población por barrio' },
        metadata_modified: '2026-05-04T10:00:00',
        frequency: 'ANUAL',
        resources: [resource('p1', '2025_pad.csv', '2026-05-04')],
      },
      {
        name: 'estat-estacions-bicing',
        title: 'Bicing stations status',
        title_translated: { ca: 'Estat de les estacions', es: 'Estado de las estaciones' },
        notes_translated: { ca: 'Estat de cada estació per barri, en temps real.' },
        metadata_modified: '2026-11-03T08:00:00',
        frequency: 'IMMEDIATA',
        token_required: 'Yes',
        resources: [resource('b1', 'estat.json', '2026-11-03')],
      },
      {
        name: 'us-del-servei-bicing',
        title: 'Bicing use',
        title_translated: { ca: 'Ús del servei Bicing', es: 'Uso del servicio Bicing' },
        metadata_modified: '2026-03-26T08:00:00',
        frequency: 'SERIE_INTERROMPUDA',
        resources: [
          resource('u1', 'us.csv', '2026-03-26'),
          resource('u2', 'us.7z', '2026-03-26', false),
        ],
      },
    ],
  },
};

test('troba títols en castellà i en català sense accents, plurals inclosos, primer pel títol', async () => {
  const { fetchImpl } = fake(catalog);
  const result = await cercarConjunt(fetchImpl, 'poblacion barris', 10);
  assert.deepEqual(
    result.conjunts.map((c) => c.id),
    ['pad_mdbas_sexe', 'estat-estacions-bicing'],
  );
  assert.equal(result.conjunts[0]!.titol, 'Població per barri');
  assert.equal(result.conjunts[0]!.frequencia, 'anual');
});

test('no compta els recursos darrere un token i mostra les sèries interrompudes', async () => {
  const { fetchImpl } = fake(catalog);
  const { conjunts } = await cercarConjunt(fetchImpl, 'del bicing', 10);
  assert.deepEqual(
    conjunts.map((c) => [c.id, c.recursos_consultables, c.frequencia, typeof c.nota]),
    [
      ['estat-estacions-bicing', 0, 'immediata', 'string'],
      ['us-del-servei-bicing', 1, 'serie_interrompuda', 'undefined'],
    ],
  );
  await assert.rejects(cercarConjunt(fetchImpl, 'de (i)', 10), /Busca pel tema/);
});

test('no busca en un catàleg que no ha arribat sencer', async () => {
  const { fetchImpl } = fake({ success: true, result: { count: 1200, results: [] } });
  await assert.rejects(
    cercarConjunt(fetchImpl, 'bicing', 10),
    /El catàleg té 1200 conjunts i només n'han arribat 0/,
  );
});

test('demana el catàleg una sola vegada, i una altra després d’un error', async () => {
  let calls = 0;
  let up = false;
  const fetchImpl: Fetch = async () => {
    calls++;
    return up ? Response.json(catalog) : Response.json({}, { status: 503 });
  };
  await assert.rejects(cercarConjunt(fetchImpl, 'bicing', 10), /La font ha respost 503/);
  up = true;
  await cercarConjunt(fetchImpl, 'bicing', 10);
  await cercarConjunt(fetchImpl, 'barri', 10);
  assert.equal(calls, 2);
});

test('ordena els recursos pel període del nom, encara que el portal no els ordeni, i en salta', async () => {
  const { fetchImpl } = fake({
    success: true,
    result: {
      name: 'qualitat-aire-detall-bcn',
      title: 'Qualitat aire',
      title_translated: { ca: "Qualitat de l'aire" },
      metadata_modified: '2026-06-18T14:02:46',
      license_title: 'Creative Commons Attribution 4.0',
      fuente: 'Generalitat de Catalunya',
      resources: [
        resource('detall', 'Qualitat_Aire_Detall.csv', '2018-06-15', false),
        resource('gener', '2026_01_Gener_qualitat_aire_BCN.csv', '2026-02-03'),
        resource('marc', '2026_03_Marc_qualitat_aire_BCN.csv', '2026-04-02'),
        resource('desembre', '2018_12_Desembre_qualitat_aire_BCN.csv', '2019-01-06'),
        resource('vell', '2012_qualitat_aire_BCN.csv', '2026-05-20'),
      ],
    },
  });
  const result = await veureConjunt(fetchImpl, 'qualitat-aire-detall-bcn');
  // Pel període del nom: el de 2012 va l'últim encara que es pugés el 2026.
  assert.deepEqual(
    result.recursos.map((r) => r.id),
    ['marc', 'gener', 'desembre', 'vell'],
  );
  assert.equal(result.recursos_consultables, 4);
  assert.equal(result.font, 'Generalitat de Catalunya');
  const older = await veureConjunt(fetchImpl, 'qualitat-aire-detall-bcn', 2);
  assert.deepEqual(
    older.recursos.map((r) => r.id),
    ['desembre', 'vell'],
  );
});

test('explica per què un conjunt no té res a consultar en lloc de tornar una llista buida', async () => {
  const { fetchImpl } = fake({
    success: true,
    result: {
      name: 'zbe-ambit',
      title: 'ZBE',
      metadata_modified: '2025-09-23T11:21:25',
      resources: [{ ...resource('gpkg', 'ambit.gpkg', '2023-01-27', false), format: 'GPKG' }],
    },
  });
  const result = await veureConjunt(fetchImpl, 'zbe-ambit');
  assert.deepEqual(result.recursos, []);
  assert.match(result.nota!, /no té recursos consultables/);
});

test('envia cada paràmetre una sola vegada i treu les columnes internes', async () => {
  const { fetchImpl, urls } = fake({
    success: true,
    result: {
      total: 287,
      fields: [
        { id: '_id', type: 'int4' },
        { id: 'ESTACIO', type: 'numeric' },
        { id: 'H01', type: 'text' },
      ],
      records: [{ _id: 186, rank: 0.05, _full_count: '287', ESTACIO: '42', H01: '14' }],
    },
  });
  const result = await consultarDades(fetchImpl, {
    recurs: '25cf65ca-e5e5-4db1-a1fd-c6608b749395',
    filtres: { ESTACIO: ['42', '4'] },
    camps: ['ESTACIO', 'H01'],
    q: '42',
    ordre: 'DIA desc',
    limit: 1,
    des_de: 0,
  });
  const params = urls[0]!.searchParams;
  assert.deepEqual(
    [...params.keys()],
    ['resource_id', 'limit', 'offset', 'filters', 'q', 'fields', 'sort'],
  );
  assert.equal(params.get('filters'), '{"ESTACIO":["42","4"]}');
  assert.deepEqual(result, {
    total: 287,
    camps: ['ESTACIO (numeric)', 'H01 (text)'],
    files: [{ ESTACIO: '42', H01: '14' }],
  });
});

test('conserva una columna real que es diu rank quan no es busca text', async () => {
  const { fetchImpl } = fake({
    success: true,
    result: {
      total: 1,
      fields: [
        { id: '_id', type: 'int4' },
        { id: 'rank', type: 'numeric' },
      ],
      records: [{ _id: 1, rank: '3' }],
    },
  });
  const result = await consultarDades(fetchImpl, { recurs: 'x', limit: 1, des_de: 0 });
  assert.deepEqual(result, { total: 1, camps: ['rank (numeric)'], files: [{ rank: '3' }] });
});

test('diu que cap fila compleix la consulta quan el portal no dona el total, i per què pot ser', async () => {
  const empty = () =>
    fake({
      success: true,
      result: { fields: [{ id: 'Nom_Districte', type: 'text' }], records: [] },
    }).fetchImpl;
  const none = await consultarDades(empty(), {
    recurs: 'x',
    filtres: { Nom_Districte: 'Gracia' },
    limit: 5,
    des_de: 0,
  });
  assert.equal(none.total, 0);
  assert.match(none.nota!, /accents/);
  await assert.rejects(consultarDades(empty(), { recurs: 'x', limit: 5, des_de: 900 }), /des de 0/);
});

test('dona el total quan només es demanen els camps, perquè el portal no el dona amb limit 0', async () => {
  const { fetchImpl, urls } = fake({
    success: true,
    result: {
      total: 7741,
      fields: [{ id: 'Nom_Districte', type: 'text' }],
      records: [{ _id: 1, Nom_Districte: 'Gràcia' }],
    },
  });
  const result = await consultarDades(fetchImpl, { recurs: 'x', limit: 0, des_de: 0 });
  assert.equal(urls[0]!.searchParams.get('limit'), '1');
  assert.deepEqual(result, { total: 7741, camps: ['Nom_Districte (text)'], files: [] });
});

test('passa el que el portal diu que falla d’un camp, i un recurs que no existeix', async () => {
  const invalid = fake(
    { success: false, error: { __type: 'Validation Error', sort: ['invalid value "nope desc"'] } },
    409,
  ).fetchImpl;
  await assert.rejects(
    consultarDades(invalid, { recurs: 'x', ordre: 'nope desc', limit: 1, des_de: 0 }),
    /Paràmetre no vàlid: sort: invalid value "nope desc"\./,
  );
  const missing = fake({ success: false, error: { __type: 'Not Found Error' } }, 404).fetchImpl;
  await assert.rejects(
    consultarDades(missing, { recurs: 'x', limit: 1, des_de: 0 }),
    /No existeix aquest conjunt o recurs/,
  );
});

test("envia les peticions d'una en una, perquè el portal rebutja les simultànies", async () => {
  let open = 0;
  let most = 0;
  const fetchImpl: Fetch = async () => {
    most = Math.max(most, ++open);
    await new Promise((resolve) => setTimeout(resolve, 5));
    open--;
    return Response.json({ success: true, result: { total: 0, fields: [], records: [] } });
  };
  await Promise.all(
    [1, 2, 3].map(() => consultarDades(fetchImpl, { recurs: 'x', limit: 1, des_de: 0 })),
  );
  assert.equal(most, 1);
});

test('només en dona el codi quan el portal falla amb una pàgina HTML', async () => {
  const html =
    (status: number): Fetch =>
    async () =>
      new Response('<h1>Server Error</h1>', { status });
  await assert.rejects(veureConjunt(html(500), 'x'), /La font ha respost 500\./);
  await assert.rejects(veureConjunt(html(409), 'x'), /La font ha respost 409\./);
});
