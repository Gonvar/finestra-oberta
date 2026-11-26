// Respostes sintètiques amb la forma de les de Renfe, FGC i TMB del 23/11/2026.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { FontNoRespon, SourceError, type Fetch } from './comun.ts';
import {
  actualitzaResum,
  afegeixFoto,
  baixa,
  construeixFoto,
  decodifica,
  diaHora,
  empremta,
  FONTS,
  resumDia,
  type Font,
  type Foto,
} from './historic.ts';
import { verificaFoto } from './verifica-foto.ts';

const viatge = (tripId: string, delay?: number, scheduleRelationship = 'SCHEDULED') => ({
  id: tripId,
  tripUpdate: { trip: { tripId, scheduleRelationship }, ...(delay !== undefined && { delay }) },
});

function respostes(
  rodalies: object[],
  fgc: object[],
  metro: object[] = [],
  bus: object[] = [],
): Record<Font, string> {
  return {
    rodalies: JSON.stringify({ header: { timestamp: '1795420800' }, entity: rodalies }),
    fgc: JSON.stringify(fgc),
    'fgc-metadades': JSON.stringify({
      metas: { default: { data_processed: '2026-11-23T07:56:02+00:00' } },
    }),
    'tmb-metro': JSON.stringify({ status: 'success', data: { alerts: metro } }),
    'tmb-bus': JSON.stringify({ status: 'success', data: { alerts: bus } }),
  };
}

const foto = (r: Record<Font, string>, consultat: string): Foto => ({
  ...construeixFoto(r, consultat, null),
  captures: [],
});

const metro = (id: number, linia: string, text: string) => ({
  id,
  disruption_dates: [{ begin_date: 1795000000000, end_date: null }],
  entities: [{ line_name: linia, station_name: null }],
  publications: [{ headerCa: 'Avís', textCa: text }],
});

test('agrupa les fotos pel dia a Catalunya, no pel dia en UTC', () => {
  assert.deepEqual(diaHora(new Date('2026-11-23T23:20:00Z')), {
    dia: '2026-11-24',
    hora: '00:20',
    instant: '002000',
  });
  assert.deepEqual(diaHora(new Date('2026-07-01T21:59:00Z')), {
    dia: '2026-07-01',
    hora: '23:59',
    instant: '235900',
  });
});

test('compta cada tren un sol cop al dia, amb el retard més gran que se n’ha vist', () => {
  const f1 = foto(
    respostes(
      [viatge('5126L1R2N', 120), viatge('5126L2R2N', 600), viatge('1026L9C1', 900)],
      [
        { id: 'a', lin: 'S1', en_hora: 'True' },
        { id: 'b', lin: 'S1', en_hora: 'True' },
      ],
      [metro(1, 'L1', 'Ascensor fora de servei.')],
    ),
    '2026-11-23T08:00:00Z',
  );
  const f2 = foto(
    respostes(
      [
        viatge('5126L1R2N', 420),
        viatge('5126L2R2N', 60),
        viatge('5126L3R2N', undefined, 'CANCELED'),
      ],
      [
        { id: 'a', lin: 'S1', en_hora: 'False' },
        { id: 'b', lin: 'S1', en_hora: 'True' },
        { id: 'c', lin: 'S2', en_hora: null },
      ],
      [metro(1, 'L1', 'Ascensor fora de servei.'), metro(2, 'L3', 'Obres.')],
    ),
    '2026-11-23T08:30:00Z',
  );
  const dia = afegeixFoto(afegeixFoto(null, f1), f2);
  // La mateixa foto dues vegades no compta doble.
  assert.deepEqual(afegeixFoto(dia, f2), dia);
  const r = resumDia(dia);
  assert.equal(r.fotos, 2);
  assert.deepEqual(r.rodalies, {
    R2N: { trens: 2, amb_retard_de_5_min_o_mes: 2, sense_retard_publicat: 0, cancellats: 1 },
  });
  assert.deepEqual(r.fgc, {
    S1: { trens: 2, fora_d_hora: 1, sense_dada: 0 },
    S2: { trens: 0, fora_d_hora: 0, sense_dada: 1 },
  });
  assert.deepEqual(r.tmb, { metro: { L1: 1, L3: 1 }, bus: {} });
  assert.equal(dia.tmb['metro-1']!.primer, '2026-11-23T08:00:00Z');
  assert.equal(dia.tmb['metro-1']!.darrer, '2026-11-23T08:30:00Z');
});

test('un tren que acaba cancel·lat compta com a cancel·lat, i no també com a circulant', () => {
  const abans = foto(respostes([viatge('5126L1R2N', 600)], []), '2026-11-23T08:00:00Z');
  const despres = foto(
    respostes([viatge('5126L1R2N', undefined, 'CANCELED')], []),
    '2026-11-23T08:30:00Z',
  );
  const r = resumDia(afegeixFoto(afegeixFoto(null, abans), despres));
  assert.deepEqual(r.rodalies.R2N, {
    trens: 0,
    amb_retard_de_5_min_o_mes: 0,
    sense_retard_publicat: 0,
    cancellats: 1,
  });
});

test('un tren sense dada no compta al total, perquè no faci semblar la línia més puntual', () => {
  const f = foto(
    respostes(
      [viatge('5126L1R1', 600), viatge('5126L2R1'), viatge('5126L3R1'), viatge('5126L4R1', 0)],
      [],
    ),
    '2026-11-23T08:00:00Z',
  );
  assert.deepEqual(resumDia(afegeixFoto(null, f)).rodalies.R1, {
    trens: 2,
    amb_retard_de_5_min_o_mes: 1,
    sense_retard_publicat: 2,
    cancellats: 0,
  });
});

test("no barreja una foto amb el resum d'un altre dia", () => {
  const f = foto(respostes([], []), '2026-11-23T08:00:00Z');
  const altre = { ...afegeixFoto(null, f), dia: '2026-11-22' };
  assert.throws(() => afegeixFoto(altre, f), /no és el del dia de la foto/);
});

test('el resum general substitueix el dia d’avui i deixa els altres, del més recent al més antic', () => {
  const ahir = afegeixFoto(null, foto(respostes([], []), '2026-11-22T08:00:00Z'));
  const fa = foto(respostes([viatge('5126L1R1', 0)], []), '2026-11-23T08:00:00Z');
  const fb = foto(respostes([viatge('5126L1R1', 0)], []), '2026-11-23T08:30:00Z');
  let resum = actualitzaResum(null, ahir, foto(respostes([], []), '2026-11-22T08:00:00Z'));
  resum = actualitzaResum(resum, afegeixFoto(null, fa), fa);
  resum = actualitzaResum(resum, afegeixFoto(afegeixFoto(null, fa), fb), fb);
  assert.deepEqual(
    resum.dies.map((d) => [d.dia, d.fotos]),
    [
      ['2026-11-23', 2],
      ['2026-11-22', 1],
    ],
  );
  assert.equal(resum.actualitzat, '2026-11-23T08:30:00Z');
});

test('el resum només guarda els últims 30 dies', () => {
  let resum = null;
  for (let i = 1; i <= 35; i++) {
    const f = foto(respostes([], []), new Date(Date.UTC(2026, 9, i, 10)).toISOString());
    resum = actualitzaResum(resum, afegeixFoto(null, f), f);
  }
  assert.equal(resum!.dies.length, 30);
  assert.equal(resum!.dies[0]!.dia, '2026-11-04');
});

test('una foto es pot tornar a fer amb les còpies, i una còpia tocada es detecta', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'foto-'));
  // Un avís de bus sense causa: el camp no es desa al JSON, i la foto ha de quadrar igualment.
  const bus = [
    {
      id: 7,
      begin: 1795000000000,
      end: null,
      typeName: 'Desviament',
      linesAffected: [{ commercialLineId: 'H12' }],
      channelInfoTO: { textCa: 'Desviament.' },
    },
  ];
  const r = respostes(
    [viatge('5126L1R2N', 120)],
    [{ id: 'a', lin: 'S1', en_hora: 'True' }],
    [],
    bus,
  );
  const fonts = Object.keys(FONTS) as Font[];
  const captures = fonts.map((font) => ({
    font,
    url: FONTS[font],
    sha256: empremta(Buffer.from(r[font])),
    fitxer: `captures/${font}.json.gz`,
  }));
  await mkdir(join(carpeta, 'captures'));
  for (const c of captures)
    await writeFile(join(carpeta, c.fitxer), gzipSync(Buffer.from(r[c.font])));
  const f = { ...construeixFoto(r, '2026-11-23T08:00:00Z', null), captures };
  await writeFile(join(carpeta, 'foto.json'), JSON.stringify(f));
  await verificaFoto(carpeta, 'foto.json');

  const retocada = structuredClone(f);
  retocada.rodalies.linies.R2N!.retards['5126L1R2N'] = 0;
  await writeFile(join(carpeta, 'retocada.json'), JSON.stringify(retocada));
  await assert.rejects(verificaFoto(carpeta, 'retocada.json'), /no surt de les seves còpies/);

  await writeFile(join(carpeta, 'captures/fgc.json.gz'), gzipSync('[]'));
  await assert.rejects(verificaFoto(carpeta, 'foto.json'), /no té l'empremta/);
});

test('una resposta que no és UTF-8 és un error, no un caràcter canviat', () => {
  assert.equal(decodifica(Buffer.from('{"a":"è"}'), 'fgc'), '{"a":"è"}');
  assert.throws(() => decodifica(new Uint8Array([0x7b, 0xff, 0x7d]), 'fgc'), /no és UTF-8/);
});

test('si FGC no ha respost, la foto es fa igual, ho diu i es pot tornar a fer', async () => {
  const totes = respostes([viatge('5126L1R2N', 600)], [{ id: 'a', lin: 'S1', en_hora: 'False' }]);
  const { fgc, 'fgc-metadades': _, ...sense } = totes;
  const r: Partial<Record<Font, string>> = sense;
  const error = `${FONTS.fgc} no respon.`;
  const f: Foto = { ...construeixFoto(r, '2026-11-26T01:07:00Z', error), captures: [] };
  assert.deepEqual(f.fgc, { no_ha_respost: error });
  assert.equal(f.rodalies.linies.R2N!.retards['5126L1R2N'], 600);

  // El dia no perd els trens d'FGC de les fotos d'abans, i el resum diu que ara FGC no respon.
  const abans = afegeixFoto(null, foto(totes, '2026-11-26T00:37:00Z'));
  const dia = afegeixFoto(abans, f);
  assert.deepEqual(dia.fgc, abans.fgc);
  assert.deepEqual(actualitzaResum(null, dia, f).ara.fgc, { no_ha_respost: error });

  assert.throws(
    () => construeixFoto({ ...r, fgc }, '2026-11-26T01:07:00Z', error),
    /en té la resposta/,
  );

  const carpeta = await mkdtemp(join(tmpdir(), 'foto-sense-fgc-'));
  await mkdir(join(carpeta, 'captures'));
  const fonts = Object.keys(r) as Font[];
  const captures = fonts.map((font) => ({
    font,
    url: FONTS[font],
    sha256: empremta(Buffer.from(r[font]!)),
    fitxer: `captures/${font}.json.gz`,
  }));
  for (const c of captures)
    await writeFile(join(carpeta, c.fitxer), gzipSync(Buffer.from(r[c.font]!)));
  await writeFile(join(carpeta, 'foto.json'), JSON.stringify({ ...f, captures }));
  await verificaFoto(carpeta, 'foto.json');
});

test('només és «no respon» una connexió que falla o un 429 o 5xx, no una adreça que ja no hi és', async () => {
  const amb = (f: () => Promise<Response>) => f as unknown as Fetch;
  const caiguda = amb(() => Promise.reject(new TypeError('fetch failed')));
  await assert.rejects(baixa(caiguda, FONTS.fgc), FontNoRespon);
  await assert.rejects(
    baixa(
      amb(async () => new Response('', { status: 503 })),
      FONTS.fgc,
    ),
    FontNoRespon,
  );
  await assert.rejects(
    baixa(
      amb(async () => new Response('', { status: 404 })),
      FONTS.fgc,
    ),
    (e) => e instanceof SourceError && !(e instanceof FontNoRespon),
  );
});
