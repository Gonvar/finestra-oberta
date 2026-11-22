// Files sintètiques amb la forma de les de Dades obertes de Catalunya del 22/11/2026 (registre d'ens
// locals i composició dels plens). Els municipis i les persones són inventats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { construirAjuntaments, ENS_LOCALS, PLENS } from './ajuntaments.ts';
import type { Fetch } from './comun.ts';

const META = {
  name: 'Conjunt',
  attribution: 'Secretaria de Governs Locals',
  rowsUpdatedAt: 1795235416,
};

const MUNICIPIS = [
  {
    codi_ens: '0899990001',
    nom_complert: 'Vilanova de Prova',
    comarca: 'Comarca A',
    provincia: 'Barcelona',
    cens: '1200',
    any_cens: '2025',
    web: 'http://www.exemple.cat',
  },
  {
    codi_ens: '1799980002',
    nom_complert: 'Àger de Prova',
    comarca: 'Comarca B',
    provincia: 'Girona',
  },
];

const ELECTES = [
  {
    codi_10: '0899990001',
    nom_ens: 'Ajuntament de Vilanova de Prova',
    nom: 'PERSONA U',
    carrec: 'Alcalde President',
    area: 'Hisenda',
    partit_politic: 'P1',
    ordre: '1',
    data_nomenament: '2023-06-17T00:00:00.000',
  },
  {
    codi_10: '0899990002',
    nom_ens: 'Ajuntament de Vilanova de Prova',
    nom: 'Persona Dos',
    carrec: 'Regidora',
    partit_politic: 'P2',
    ordre: '2',
  },
  { codi_10: '1799980002', nom_ens: "Ajuntament d'Àger de Prova", ordre: '1' },
];

function fake(municipis: object[] = MUNICIPIS, electes: object[] = ELECTES) {
  const demanades: string[] = [];
  const fetchImpl: Fetch = async (input) => {
    const url = String(input);
    demanades.push(url);
    if (url.includes('/api/views/')) return Response.json(META);
    if (url.includes(`/resource/${ENS_LOCALS}.json`)) return Response.json(municipis);
    if (url.includes(`/resource/${PLENS}.json`)) return Response.json(electes);
    return new Response('no', { status: 404 });
  };
  return { fetchImpl, demanades };
}

test('cada municipi surt amb el seu ple, en l’ordre de la font, i amb els mateixos camps', async () => {
  const { fetchImpl } = fake();
  const resultat = await construirAjuntaments(fetchImpl);
  assert.equal(resultat.data_dades, '2026-11-21');
  assert.deepEqual(
    resultat.municipis.map((m) => m.nom),
    ['Àger de Prova', 'Vilanova de Prova'],
  );
  const [ager, vilanova] = resultat.municipis;
  assert.deepEqual(vilanova, {
    codi: '089999',
    nom: 'Vilanova de Prova',
    ajuntament: 'Ajuntament de Vilanova de Prova',
    comarca: 'Comarca A',
    provincia: 'Barcelona',
    habitants: 1200,
    any_habitants: 2025,
    web: 'http://www.exemple.cat',
    ple: [
      {
        nom: 'PERSONA U',
        carrec: 'Alcalde President',
        area: 'Hisenda',
        partit: 'P1',
        ordre: 1,
        data_nomenament: '2023-06-17',
      },
      { nom: 'Persona Dos', carrec: 'Regidora', partit: 'P2', ordre: 2 },
    ],
  });
  // Un seient que la font dona sense nom es publica sense nom, no s'amaga.
  assert.deepEqual(ager!.ple, [{ ordre: 1 }]);
});

test('només demana els municipis i els plens dels ajuntaments', async () => {
  const { fetchImpl, demanades } = fake();
  await construirAjuntaments(fetchImpl);
  const params = demanades
    .filter((u) => u.includes('/resource/'))
    .map((u) => new URL(u).searchParams.get('$where'));
  assert.deepEqual(params, ["nomtipus = 'Municipis'", "codi_tipus_ens = '2'"]);
});

test('falla si un municipi no té ple', async () => {
  const { fetchImpl } = fake(MUNICIPIS, ELECTES.slice(0, 2));
  await assert.rejects(construirAjuntaments(fetchImpl), /Àger de Prova \(179998\) no té ple/);
});

test('falla si un ple no és de cap municipi del registre', async () => {
  const { fetchImpl } = fake(MUNICIPIS.slice(0, 1));
  await assert.rejects(construirAjuntaments(fetchImpl), /no són al registre: 179998/);
});

test('falla si un codi correspon a dos ajuntaments', async () => {
  const electes = [...ELECTES, { ...ELECTES[1], nom_ens: 'Ajuntament d’un altre lloc' }];
  const { fetchImpl } = fake(MUNICIPIS, electes);
  await assert.rejects(construirAjuntaments(fetchImpl), /089999 correspon a/);
});

test('falla si un municipi surt dues vegades al registre', async () => {
  const { fetchImpl } = fake([...MUNICIPIS, MUNICIPIS[0]!]);
  await assert.rejects(construirAjuntaments(fetchImpl), /089999 surt dues vegades/);
});

test('falla si un codi no té deu xifres', async () => {
  const { fetchImpl } = fake([{ ...MUNICIPIS[0]!, codi_ens: '08999' }, MUNICIPIS[1]!]);
  await assert.rejects(construirAjuntaments(fetchImpl), /Codi d'ens inesperat: 08999/);
});

test('falla si el cens no és un nombre', async () => {
  const { fetchImpl } = fake([{ ...MUNICIPIS[0]!, cens: 'molts' }, MUNICIPIS[1]!]);
  await assert.rejects(construirAjuntaments(fetchImpl), /El cens no és un nombre/);
});
