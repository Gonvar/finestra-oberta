// Respostes sintètiques amb la forma de les APIs de Renfe, FGC i TMB del 23/11/2026.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { liniaViatge } from './operadors.ts';
import {
  avisosRodalies,
  estacionsFgc,
  avisosTmb,
  horarisFgc,
  propersTmb,
  retardsFgc,
  retardsRodalies,
} from './transport.ts';

/** Un `fetch` que respon segons el camí de la URL i recorda les URL demanades. */
function fake(rutes: Record<string, unknown>) {
  const urls: URL[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    const cami = Object.keys(rutes).find((r) => url.pathname.endsWith(r));
    if (cami === undefined) return new Response('', { status: 404 });
    return Response.json(rutes[cami]);
  };
  return { fetchImpl, urls };
}

const viatge = (tripId: string, delay?: number, scheduleRelationship = 'SCHEDULED') => ({
  id: `TUUPDATE_${tripId}`,
  tripUpdate: { trip: { tripId, scheduleRelationship }, ...(delay !== undefined && { delay }) },
});

test('llegeix el nucli i la línia dels identificadors de viatge de Renfe', () => {
  assert.deepEqual(liniaViatge('5126L28416R2N'), { nucli: '51', linia: 'R2N' });
  assert.deepEqual(liniaViatge('5126L15004R15'), { nucli: '51', linia: 'R15' });
  assert.deepEqual(liniaViatge('3126L23289C1a'), { nucli: '31', linia: 'C1a' });
  assert.deepEqual(liniaViatge('SPECIAL_10_91025C7'), { nucli: '10', linia: 'C7' });
  assert.throws(() => liniaViatge('XYZ'), /identificador inesperat: XYZ/);
});

test("un identificador estrany d'un altre nucli no fa fallar Rodalies", async () => {
  const { fetchImpl } = fake({
    '/trip_updates.json': {
      header: { timestamp: '1795420800' },
      entity: [viatge('EXTRA_10_123C5', 60), viatge('5126L28416R2N', 455)],
    },
  });
  const r = await retardsRodalies(fetchImpl);
  assert.deepEqual(
    r.linies.map((l) => [l.linia, l.retard_maxim_min]),
    [['R2N', 7.6]],
  );
});

test('només compta els trens de Rodalies de Catalunya, i els cancel·lats a part', async () => {
  const { fetchImpl } = fake({
    '/trip_updates.json': {
      header: { timestamp: '1795420800' },
      entity: [
        viatge('5126L28416R2N', 60),
        viatge('5126L28414R2N', 480),
        viatge('5126L28418R2N', -120),
        viatge('5126L28420R2N', undefined, 'CANCELED'),
        viatge('5126L15904R11'),
        viatge('1026L23521C1', 900),
      ],
    },
  });
  const r = await retardsRodalies(fetchImpl);
  assert.equal(r.dades_de, '2026-11-23T08:00:00.000Z');
  assert.deepEqual(r.linies, [
    {
      linia: 'R2N',
      trens_circulant: 3,
      trens_cancellats: 1,
      amb_retard_de_5_min_o_mes: 1,
      retard_mitja_min: 2.3,
      retard_maxim_min: 8,
    },
    {
      linia: 'R11',
      trens_circulant: 1,
      trens_cancellats: 0,
      amb_retard_de_5_min_o_mes: 0,
      retard_mitja_min: null,
      retard_maxim_min: null,
      sense_retard_publicat: 1,
    },
  ]);
});

test("ajunta els avisos repetits de Rodalies i deixa fora els d'altres nuclis", async () => {
  const avis = (id: string, entitats: object[], text: string) => ({
    id,
    alert: {
      activePeriod: [{ start: '1795416900' }],
      informedEntity: entitats,
      descriptionText: { translation: [{ text, language: 'es' }] },
    },
  });
  const { fetchImpl } = fake({
    '/alerts.json': {
      header: { timestamp: '1795420800' },
      entity: [
        avis('AVISO_1', [{ routeId: '51T0025R2' }, { routeId: '51T0026R2S' }], 'Obras en R2.'),
        avis('AVISO_1', [{ routeId: '51T0013R2N' }], 'Obras en R2.'),
        avis('INFO_2', [{ stopId: '71801' }], 'Ascensor fuera de servicio.'),
        avis('AVISO_3', [{ routeId: '10T0075C10' }], 'Madrid.'),
        avis('INFO_4', [{ stopId: '51100' }], 'Sevilla.'),
        avis('AVISO_5', [{ routeId: '10T0075-RARA' }], 'Madrid, amb una ruta estranya.'),
      ],
    },
    '/datastore_search': {
      success: true,
      result: {
        total: 1,
        records: [
          {
            CÓDIGO: 71801,
            DESCRIPCION: 'BARCELONA-SANTS',
            POBLACION: 'Barcelona',
            LATITUD: 41.37,
            LONGITUD: 2.13,
          },
        ],
      },
    },
  });
  const r = await avisosRodalies(fetchImpl);
  assert.equal(r.total, 2);
  assert.deepEqual(
    r.avisos.map((a) => [a.id, a.linies, a.estacions, a.textos]),
    [
      ['AVISO_1', ['R2', 'R2N', 'R2S'], [], ['Obras en R2.']],
      ['INFO_2', [], ['BARCELONA-SANTS'], ['Ascensor fuera de servicio.']],
    ],
  );
});

test('un avís de Rodalies amb una ruta que no s’entén és un error, no desapareix', async () => {
  const { fetchImpl } = fake({
    '/alerts.json': {
      header: { timestamp: '1795420800' },
      entity: [
        {
          id: 'AVISO_9',
          alert: {
            informedEntity: [{ routeId: '51T0025R2-BIS' }],
            descriptionText: { translation: [{ text: 'Obras.', language: 'es' }] },
          },
        },
      ],
    },
    '/datastore_search': { success: true, result: { total: 0, records: [] } },
  });
  await assert.rejects(avisosRodalies(fetchImpl), /ruta d'identificador inesperat: 51T0025R2-BIS/);
});

test("compta els trens d'FGC en hora i falla amb un valor que no coneix", async () => {
  const meta = {
    metas: { default: { data_processed: '2026-11-23T07:56:02+00:00', title: 'Geotren' } },
  };
  const trens = [
    { lin: 'S1', en_hora: 'True' },
    { lin: 'S1', en_hora: 'False' },
    { lin: 'S2', en_hora: null },
  ];
  const { fetchImpl } = fake({
    '/posicionament-dels-trens/exports/json': trens,
    '/posicionament-dels-trens': meta,
  });
  const r = await retardsFgc(fetchImpl);
  assert.equal(r.dades_de, '2026-11-23T07:56:02+00:00');
  assert.deepEqual(r.linies, [
    { linia: 'S1', trens_circulant: 2, en_hora: 1, fora_d_hora: 1 },
    { linia: 'S2', trens_circulant: 1, en_hora: 0, fora_d_hora: 0, sense_dada: 1 },
  ]);
  const { fetchImpl: dolent } = fake({
    '/posicionament-dels-trens/exports/json': [{ lin: 'S1', en_hora: 'Potser' }],
    '/posicionament-dels-trens': meta,
  });
  await assert.rejects(retardsFgc(dolent), /valor inesperat a en_hora: Potser/);
});

const pas = (departure_time: string, route_short_name: string) => ({
  date: '2026-11-23',
  route_short_name,
  trip_headsign: 'Sabadell Parc del Nord',
  departure_time,
  platform_code: 1,
});

test("dona els propers trens d'FGC en ordre, amb l'hora escrita sempre igual", async () => {
  const { fetchImpl, urls } = fake({
    '/viajes-de-hoy/exports/json': [
      pas('24:10:00', 'S2'),
      pas('8:59:00', 'S1'),
      pas('23:50:00', 'S1'),
      pas('09:03:00', 'S2'),
    ],
  });
  // Les 9.00 del 23 de novembre a Catalunya.
  const mati = new Date('2026-11-23T08:00:00Z');
  const r = await horarisFgc(
    fetchImpl,
    { estacio: "L'Hospitalet", des_de: '08:00', limit: 2 },
    mati,
  );
  assert.equal(urls[0]!.searchParams.get('where'), "stop_name = 'L''Hospitalet'");
  assert.equal(r.total, 4);
  assert.deepEqual(
    r.trens.map((t) => [t.sortida, t.linia]),
    [
      ['08:59', 'S1'],
      ['09:03', 'S2'],
    ],
  );
  const buit = fake({ '/viajes-de-hoy/exports/json': [] });
  await assert.rejects(
    horarisFgc(buit.fetchImpl, { estacio: 'Sarria', limit: 5 }, mati),
    /Cap tren d'FGC passa avui per «Sarria»/,
  );
});

test('passada la mitjanit, els propers trens són els del dia de servei anterior', async () => {
  const { fetchImpl } = fake({
    '/viajes-de-hoy/exports/json': [
      pas('05:10:00', 'S1'),
      pas('23:50:00', 'S1'),
      pas('24:35:00', 'S2'),
    ],
  });
  // Les 00.20 del 24 de novembre a Catalunya, amb els horaris del 23 encara publicats.
  const nit = new Date('2026-11-23T23:20:00Z');
  const r = await horarisFgc(fetchImpl, { estacio: 'Sarrià', limit: 5 }, nit);
  assert.equal(r.des_de, '00:20');
  assert.deepEqual(
    r.trens.map((t) => t.sortida),
    ['24:35'],
  );
});

test("l'accessibilitat d'FGC es llegeix com diu GTFS: 0 és que no se sap", async () => {
  const parada = (stop_id: string, stop_name: string, wheelchair_boarding: number) => ({
    stop_id,
    stop_name,
    stop_coordinates: { lat: 41.4, lon: 2.1 },
    wheelchair_boarding,
  });
  const { fetchImpl } = fake({
    '/gtfs_stops/exports/json': [
      parada('SR', 'Sarrià', 0),
      parada('SR1', 'Sarrià', 1),
      parada('PR', 'Provença', 2),
      parada('GR', 'Gràcia', 0),
      parada('MN', 'Muntaner', 1),
      parada('MN1', 'Muntaner', 2),
    ],
    '/gtfs_stops': { metas: { default: { data_processed: '2026-11-22T11:30:08+00:00' } } },
  });
  const r = await estacionsFgc(fetchImpl, 'a');
  assert.deepEqual(
    r.estacions.map((e) => [e.nom, e.accessible]),
    [
      ['Sarrià', 'sí'],
      ['Provença', 'no'],
      ['Gràcia', 'sense informació'],
      ['Muntaner', 'segons l’andana'],
    ],
  );
});

test('sense la clau de TMB no fa cap crida i ho diu', async (t) => {
  t.after(() => {
    delete process.env.TMB_APP_ID;
    delete process.env.TMB_APP_KEY;
  });
  delete process.env.TMB_APP_ID;
  const { fetchImpl, urls } = fake({});
  await assert.rejects(avisosTmb(fetchImpl), /cal definir TMB_APP_ID i TMB_APP_KEY/);
  assert.equal(urls.length, 0);
});

test('demana els metros de totes les línies de l’estació i en calcula els minuts', async (t) => {
  t.after(() => {
    delete process.env.TMB_APP_ID;
    delete process.env.TMB_APP_KEY;
  });
  process.env.TMB_APP_ID = 'id-de-prova';
  process.env.TMB_APP_KEY = 'clau-de-prova';
  const estacio = (CODI_ESTACIO: number, NOM_LINIA: string) => ({
    properties: { CODI_ESTACIO, NOM_ESTACIO: 'Catalunya', NOM_LINIA },
  });
  const ara = 1795420800000;
  const { fetchImpl, urls } = fake({
    '/transit/linies/metro/estacions': { features: [estacio(126, 'L1'), estacio(326, 'L3')] },
    '/itransit/metro/estacions': {
      timestamp: ara,
      linies: [
        {
          nom_linia: 'L1',
          estacions: [
            {
              linies_trajectes: [
                {
                  desti_trajecte: 'Fondo',
                  propers_trens: [
                    { temps_arribada: ara + 65_000 },
                    { temps_arribada: ara - 5_000 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  const r = await propersTmb(fetchImpl, { metro: 'Catalunya' });
  assert.equal(urls[1]!.searchParams.get('estacions'), '126,326');
  assert.equal(urls[1]!.searchParams.get('app_key'), 'clau-de-prova');
  assert.deepEqual(r.trens, [{ linia: 'L1', direccio: 'Fondo', arribades_min: [1, 0] }]);
  const err = await propersTmb(fetchImpl, { metro: 'Catalunia' }).catch((e: Error) => e);
  assert.ok(err instanceof Error);
  assert.match(err.message, /cap estació de metro que es digui «Catalunia»/);
  assert.doesNotMatch(err.message, /clau-de-prova/);
});
