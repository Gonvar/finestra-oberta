// Prepara una font nova a partir d'aquesta plantilla: el servidor, les proves i la documentació, ja
// registrats. El que queda per fer és a cada TODO, i src/servidors.test.ts falla fins que està fet.
//   npm run nova-font -- <nom> --organisme "Ajuntament de Girona" --domini girona.cat
import { access, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

function atura(missatge: string): never {
  console.error(missatge);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { organisme: { type: 'string' }, domini: { type: 'string' } },
});
const [nom] = positionals;
const { organisme, domini } = values;
if (!nom || !/^[a-z]+(-[a-z]+)*$/.test(nom))
  atura('Indica el nom de la font, en minúscules i amb guions: npm run nova-font -- <nom> …');
if (!organisme || /["`$\\]/.test(organisme))
  atura(
    'Indica l’organisme públic amb --organisme "…", sense cometes dobles, accents greus, $ ni \\.',
  );
// El mateix format que els dominis de la taula de NEUTRALITAT.md, sense protocol ni camí.
if (!domini || !/^[a-z0-9.-]+\.[a-z]+$/.test(domini))
  atura('Indica el domini de la font amb --domini, com girona.cat, sense https:// ni camí.');

const arrel = new URL('../', import.meta.url);
const llegeix = (cami: string) => readFile(new URL(cami, arrel), 'utf8');
const existeix = (cami: string) =>
  access(new URL(cami, arrel)).then(
    () => true,
    () => false,
  );

const funcio = `create${nom.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase())}Server`;
const valors: Record<string, string> = {
  __NOM__: nom,
  __FUNCIO__: funcio,
  // Al codi, el text va entre cometes simples: l'apòstrof tipogràfic no les tanca.
  __ORGANISME__: organisme.replaceAll("'", '’'),
  __DOMINI__: domini,
  __QUE_PUBLICA__: 'TODO: quines dades publica',
  __API__: `https://${domini}/TODO`,
  __LLICENCIA__: `https://${domini}/TODO-llicencia`,
};
const omple = (text: string) =>
  text.replace(/__[A-Z_]+__/g, (clau) => {
    const valor = valors[clau];
    if (valor === undefined) throw new Error(`La plantilla té ${clau}, que no té valor.`);
    return valor;
  });

/** Un canvi que no troba on fer-se és un error: la font quedaria fora del registre sense avisar. */
function substitueix(text: string, patro: string | RegExp, nou: string, fitxer: string) {
  const resultat = text.replace(patro, nou);
  if (resultat === text) throw new Error(`No he trobat on afegir la font a ${fitxer}.`);
  return resultat;
}

const nous: Record<string, string> = {
  [`src/${nom}.ts`]: 'plantilla/servidor.ts',
  [`src/${nom}.test.ts`]: 'plantilla/servidor.test.ts',
  [`docs/${nom}.md`]: 'plantilla/docs.md',
};
for (const desti of Object.keys(nous)) if (await existeix(desti)) atura(`${desti} ja existeix.`);

const paquet = JSON.parse(await llegeix('package.json'));
if (nom in paquet.scripts) atura(`package.json ja té un script «${nom}».`);
paquet.scripts[nom] = `node src/index.ts ${nom}`;

const registre = await llegeix('src/servidors.ts');
if (registre.includes(`nom: '${nom}'`)) atura(`src/servidors.ts ja té la font «${nom}».`);
const entrada = `  {
    nom: '${nom}',
    organisme: ${JSON.stringify(organisme)},
    domini: '${domini}',
    llicencia: '${valors.__LLICENCIA__}',
    docs: 'docs/${nom}.md',
    proves: 'src/${nom}.test.ts',
    crea: ${funcio},
  },
];
`;
const registreNou = substitueix(
  substitueix(
    registre,
    "import type { Fetch } from './comun.ts';",
    `import type { Fetch } from './comun.ts';\nimport { ${funcio} } from './${nom}.ts';`,
    'src/servidors.ts',
  ),
  /\n\];\s*$/,
  `\n${entrada}`,
  'src/servidors.ts',
);

// La fila va després de l'última de la taula de servidors.
const readme = substitueix(
  await llegeix('README.md'),
  /(^\| \[`[a-z-]+`\]\(docs\/[a-z-]+\.md\).*\n)(?!\| \[`)/m,
  `$1| [\`${nom}\`](docs/${nom}.md) | TODO: la font, amb l'enllaç | TODO: què s'hi pot preguntar |\n`,
  'README.md',
);

// Tot s'ha preparat abans d'escriure res: si alguna cosa falla, no queda cap fitxer a mitges.
const escriu = (cami: string, text: string) => writeFile(new URL(cami, arrel), text);
for (const [desti, origen] of Object.entries(nous))
  await escriu(desti, omple(await llegeix(origen)));
await escriu('src/servidors.ts', registreNou);
await escriu('package.json', `${JSON.stringify(paquet, null, 2)}\n`);
await escriu('README.md', readme);

console.log(`Fet. Ara:
- npm run format, perquè el registre i el README quedin amb el format del projecte.
- Omple cada TODO de src/${nom}.ts, src/${nom}.test.ts, docs/${nom}.md, src/servidors.ts i README.md.
- Si ${domini} no és a la taula de NEUTRALITAT.md, afegeix-l'hi i explica per què a la pull request.
- npm test i npm run typecheck. Prova'l contra l'API real: node src/index.ts ${nom}`);
