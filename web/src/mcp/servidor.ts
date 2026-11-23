// Servidor MCP de les dades que publica Finestra Oberta: el Govern, el Parlament, els ajuntaments,
// l'agenda, els ajuts, el pressupost, els contractes… tal com els genera i signa el workflow de dades.
// No consulta cap font: llegeix els fitxers de la web, i per això té sempre les últimes dades
// publicades sense que calgui canviar res.
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { READ_ONLY_EXTERNAL, run } from '../../../src/comun.ts';
import { MAX_ELEMENTS, type Dades } from './dades.ts';

const SOURCE =
  "Font: la que diu «fonts» de cada conjunt. El workflow de Finestra Oberta genera i signa les dades a partir d'aquesta font oficial, les notes («nota») diuen què s'hi ha fet, i «verificacio» diu com comprovar-ho. Cita la font i la data quan facis servir les dades.";

const INSTRUCTIONS = `Dades públiques de Catalunya que Finestra Oberta genera cada dia a partir de les fonts oficials: qui forma el Govern i el Parlament, el ple de cada ajuntament, l'agenda del Govern i del Parlament, què ha decidit el Parlament, els ajuts que es poden demanar, com va el pressupost de la Generalitat, els contractes i uns quants indicadors de cada municipi.
Comença per llistar_conjunts, que diu quins conjunts hi ha i d'on surt cadascun. Mira com és un conjunt amb veure_estructura i demana'n una part amb consultar, amb un camí com «consellers.3» o «municipis». En una llista, «cerca» tria els elements que contenen totes les paraules, sense accents ni majúscules; en una llista gran, cal dir en quin «camp».
Cada resposta porta «fonts», amb la font oficial, l'enllaç i la data de les dades, i «verificacio», amb l'empremta SHA-256 del fitxer i com comprovar que surt de la font. Digues sempre la font i la data. data_dades és el dia de l'última actualització de la font; data_consulta, el dia en què es va llegir. Si «fonts» no diu la data de les dades, la data de cada valor és dins del conjunt, com l'any de cada indicador a «indicadors». Les notes («nota») diuen què s'ha fet amb les dades de la font, com comptar-les o sumar-les: explica-les quan afectin la resposta.
Un valor null és una dada que la font no dona, mai un zero. Les dades són les de la font: no les completis amb el que saps ni en treguis conclusions sobre cap partit o persona que les dades no diguin.
${SOURCE}`;

// Fora de la xarxa: només llegeix els fitxers publicats a la mateixa web.
const NOMES_LECTURA = { ...READ_ONLY_EXTERNAL, openWorldHint: false } as const;

const nom = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(60)
  .describe('El nom del conjunt, de llistar_conjunts, com «govern» o «ajuntaments».');
const cami = z
  .string()
  .max(200)
  .regex(/^[^.]+(\.[^.]+)*$/, 'Els trossos del camí van separats per un punt, sense punts buits.')
  .optional()
  .describe(
    'El camí dins del conjunt, amb els camps i els números de la llista separats per punts, com «consellers.3» o «municipis». Sense camí, tot el conjunt.',
  );

export function creaServidor(dades: Dades) {
  const s = new McpServer(
    { name: 'finestra-oberta', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );
  s.registerTool(
    'llistar_conjunts',
    {
      title: 'Llistar els conjunts',
      description:
        "Els conjunts de dades publicats, amb la font oficial, l'enllaç, la data de cadascun i el dia en què es va consultar la seva font.",
      inputSchema: z.object({}),
      annotations: NOMES_LECTURA,
    },
    () => run(SOURCE, () => dades.llistar()),
  );
  s.registerTool(
    'veure_estructura',
    {
      title: 'Veure com és un conjunt',
      description:
        "Els camps d'un conjunt o d'una part, sense les dades senceres: el tipus de cada camp, quants elements té cada llista, i els valors curts. Serveix per saber quin camí demanar a consultar.",
      inputSchema: z.object({ conjunt: nom, cami }),
      annotations: NOMES_LECTURA,
    },
    ({ conjunt, cami = '' }) => run(SOURCE, () => dades.estructura(conjunt, cami)),
  );
  s.registerTool(
    'consultar',
    {
      title: 'Consultar un conjunt',
      description: `Les dades d'un camí d'un conjunt, tal com es publiquen. Si el camí és una llista, en torna una pàgina, en l'ordre de la font i amb l'índex de cada element; amb «cerca», només els elements que contenen totes les paraules, a tot l'element o al «camp» que es digui (en una llista gran, cal dir el camp). Com a màxim ${MAX_ELEMENTS} elements.`,
      inputSchema: z.object({
        conjunt: nom,
        cami,
        cerca: z
          .string()
          .trim()
          .min(2)
          .max(100)
          .optional()
          .describe('Paraules que ha de contenir cada element, com «Girona» o «Salut».'),
        camp: z
          .string()
          .max(60)
          .optional()
          .describe(
            'Un camp dels elements, com «nom»: la cerca només hi mira. Sense camp, mira tot l’element, llevat de les llistes grans, on cal dir-lo.',
          ),
        desde: z.number().int().min(0).default(0).describe('El primer element de la pàgina.'),
        quants: z.number().int().min(1).max(MAX_ELEMENTS).default(20),
      }),
      annotations: NOMES_LECTURA,
    },
    ({ conjunt, cami = '', cerca, camp, desde, quants }) =>
      run(SOURCE, () => dades.consulta(conjunt, { cami, cerca, camp, desde, quants })),
  );
  return s;
}
