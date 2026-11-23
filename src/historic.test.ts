// Respostes sintètiques amb la forma de les de Renfe, FGC i TMB del 23/11/2026.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  actualitzaResum,
  afegeixFoto,
  construeixFoto,
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
  ...construeixFoto(r, consultat),
  captures: [],
});

const metro = (id: number, linia: string, text: string) => ({
  id,
  disruption_dates: [{ begin_date: 1795000000000, end_date: null }],
  entities: [{ line_name: linia, station_name: null }],
  publications: [{ headerCa: 'Avís', textCa: text }],
});

test('agrupa les fotos pel dia a Catalunya, no pel dia en UTC', () => {
  assert.deepEqual(diaHora(new Date('2026-11-23T23:20:00Z')), { dia: '2026-11-24', hora: '00:20' });
  assert.deepEqual(diaHora(new Date('2026-07-01T21:59:00Z')), { dia: '2026-07-01', hora: '23:59' });
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
    S2: { trens: 1, fora_d_hora: 0, sense_dada: 1 },
  });
  assert.deepEqual(r.tmb, { metro: { L1: 1, L3: 1 }, bus: {} });
  assert.equal(dia.tmb['metro-1']!.primer, '2026-11-23T08:00:00Z');
  assert.equal(dia.tmb['metro-1']!.darrer, '2026-11-23T08:30:00Z');
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

test('una foto es pot tornar a fer amb les còpies, i una còpia tocada es detecta', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'foto-'));
  const r = respostes([viatge('5126L1R2N', 120)], [{ id: 'a', lin: 'S1', en_hora: 'True' }]);
  const fonts = Object.keys(FONTS) as Font[];
  const captures = fonts.map((font) => ({
    font,
    url: FONTS[font],
    sha256: empremta(r[font]),
    fitxer: `captures/${font}.json.gz`,
  }));
  await mkdir(join(carpeta, 'captures'));
  for (const c of captures) await writeFile(join(carpeta, c.fitxer), gzipSync(r[c.font]));
  const f = { ...construeixFoto(r, '2026-11-23T08:00:00Z'), captures };
  await writeFile(join(carpeta, 'foto.json'), JSON.stringify(f));
  await verificaFoto(carpeta, 'foto.json');

  const retocada = structuredClone(f);
  retocada.rodalies.linies.R2N!.retards['5126L1R2N'] = 0;
  await writeFile(join(carpeta, 'retocada.json'), JSON.stringify(retocada));
  await assert.rejects(verificaFoto(carpeta, 'retocada.json'), /no surt de les seves còpies/);

  await writeFile(join(carpeta, 'captures/fgc.json.gz'), gzipSync('[]'));
  await assert.rejects(verificaFoto(carpeta, 'foto.json'), /no té l'empremta/);
});
