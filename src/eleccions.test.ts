// Files sintètiques amb la forma de les del conjunt «Eleccions municipals. Vots» de Dades obertes de
// Catalunya del 23/11/2026. Els municipis i les candidatures són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Fetch } from './comun.ts';
import { construirEleccionsMunicipals } from './eleccions.ts';

const META = {
  name: 'Conjunt',
  attribution: 'Secretaria de Governs Locals',
  rowsUpdatedAt: 1795235416,
};
const CODIS = new Set(['089999', '179998']);

const fila = (
  codi: string,
  municipi: string,
  sigles: string,
  vots: string,
  pct: string,
  reg: string,
  any = '2023',
) => ({
  any_eleccio: any,
  codi_ens: codi,
  municipi,
  sigles_candidatura: sigles,
  vots,
  vots_1: pct,
  regidors: reg,
});

const VOTS = [
  fila('0899990001', 'Vilanova de Prova', 'B', '300', '3000', '4'),
  fila('0899990001', 'Vilanova de Prova', 'A', '700', '7000', '7'),
  fila('1799980002', 'Àger de Prova', 'C', '50', '5000', '3'),
  fila('1799980002', 'Àger de Prova', 'D', '50', '5000', '2'),
];

function fake(vots: object[] = VOTS, anys = ['2019', '2023']) {
  const crides: string[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = String(input);
    crides.push(url);
    if (url.includes('/api/views/')) return Response.json(META);
    const params = new URL(url).searchParams;
    if (params.get('$select') === 'distinct any_eleccio')
      return Response.json(anys.map((any_eleccio) => ({ any_eleccio })));
    // Com Socrata: només les files de l'any que demana el filtre.
    const any = /^any_eleccio = '(\d{4})'$/.exec(params.get('$where')!)![1];
    return Response.json(vots.filter((f) => (f as { any_eleccio: string }).any_eleccio === any));
  };
  return { fetchImpl, crides };
}

test('demana l’última elecció i ordena les candidatures de més a menys vots', async () => {
  const { fetchImpl, crides } = fake();
  const resultat = await construirEleccionsMunicipals(fetchImpl, CODIS);
  assert.equal(resultat.any, 2023);
  assert.ok(crides.some((c) => new URL(c).searchParams.get('$where') === "any_eleccio = '2023'"));
  const [ager, vilanova] = resultat.municipis;
  assert.equal(ager!.nom, 'Àger de Prova');
  assert.deepEqual(vilanova!.candidatures, [
    { sigles: 'A', vots: 700, percentatge: 70, regidors: 7 },
    { sigles: 'B', vots: 300, percentatge: 30, regidors: 4 },
  ]);
  assert.deepEqual(
    ager!.candidatures.map((c) => c.sigles),
    ['C', 'D'],
  );
});

test('el percentatge de la font és en centèsimes', async () => {
  const { fetchImpl } = fake([
    fila('0899990001', 'Vilanova de Prova', 'A', '1', '2268', '0'),
    VOTS[2]!,
  ]);
  const { municipis } = await construirEleccionsMunicipals(fetchImpl, CODIS);
  assert.equal(municipis[1]!.candidatures[0]!.percentatge, 22.68);
});

test('falla si un municipi de Municat no té resultats, o en sobra algun', async () => {
  const { fetchImpl } = fake(VOTS.slice(0, 2));
  await assert.rejects(construirEleccionsMunicipals(fetchImpl, CODIS), /falten 179998; sobren cap/);
});

test('falla si una candidatura surt dues vegades al mateix municipi', async () => {
  const { fetchImpl } = fake([...VOTS, VOTS[0]!]);
  await assert.rejects(
    construirEleccionsMunicipals(fetchImpl, CODIS),
    /dues vegades la candidatura B/,
  );
});

test('falla si els vots no són un nombre, en lloc de publicar un zero', async () => {
  const { fetchImpl } = fake([{ ...VOTS[0]!, vots: 'molts' }, ...VOTS.slice(1)]);
  await assert.rejects(construirEleccionsMunicipals(fetchImpl, CODIS), /Els vots no és un nombre/);
});

test('falla si una fila no té les sigles de la candidatura', async () => {
  const { sigles_candidatura: _, ...sense } = VOTS[0]!;
  const { fetchImpl } = fake([sense, ...VOTS.slice(1)]);
  await assert.rejects(construirEleccionsMunicipals(fetchImpl, CODIS), /no té sigles_candidatura/);
});

test('falla si un codi correspon a dos municipis', async () => {
  const { fetchImpl } = fake([...VOTS, fila('0899990001', 'Un altre', 'Z', '1', '1', '0')]);
  await assert.rejects(construirEleccionsMunicipals(fetchImpl, CODIS), /089999 correspon a/);
});

test('només publica l’última elecció, encara que el conjunt en tingui més', async () => {
  const antiga = fila('0899990001', 'Vilanova de Prova', 'VELL', '9999', '10000', '9', '2019');
  const { fetchImpl } = fake([...VOTS, antiga]);
  const { municipis } = await construirEleccionsMunicipals(fetchImpl, CODIS);
  assert.ok(municipis.every((m) => m.candidatures.every((c) => c.sigles !== 'VELL')));
});

test('falla si el conjunt no té cap elecció', async () => {
  const { fetchImpl } = fake(VOTS, []);
  await assert.rejects(construirEleccionsMunicipals(fetchImpl, CODIS), /és buit/);
});

test('falla si les files no caben en una consulta, en lloc de publicar-ne una part', async () => {
  const moltes = Array.from({ length: 50_000 }, (_, i) =>
    fila('0899990001', 'Vilanova de Prova', `S${i}`, '1', '1', '0'),
  );
  const { fetchImpl } = fake(moltes);
  await assert.rejects(construirEleccionsMunicipals(fetchImpl, CODIS), /no cap en una pàgina/);
});
