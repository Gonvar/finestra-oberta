// Prepara una font nova a partir d'aquesta plantilla: el servidor, les proves i la documentació, ja
// registrats. El que queda per fer és a cada TODO, i src/servidors.test.ts falla fins que està fet.
//   npm run nova-font -- <nom> --organisme "Ajuntament de Girona" --domini girona.cat
import { readFile, writeFile, access } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    organisme: { type: 'string', default: 'TODO: l’organisme públic' },
    domini: { type: 'string', default: 'TODO.cat' },
  },
});
const nom = positionals[0];
if (!nom || !/^[a-z]+(-[a-z]+)*$/.test(nom)) {
  console.error('Indica el nom de la font, en minúscules i amb guions: npm run nova-font -- <nom>');
  process.exit(1);
}

const arrel = new URL('../', import.meta.url);
const llegeix = (cami: string) => readFile(new URL(cami, arrel), 'utf8');
const escriu = (cami: string, text: string) => writeFile(new URL(cami, arrel), text);

const funcio = `create${nom.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase())}Server`;
const valors: Record<string, string> = {
  __NOM__: nom,
  __FUNCIO__: funcio,
  __ORGANISME__: values.organisme,
  __DOMINI__: values.domini,
  __QUE_PUBLICA__: 'TODO: quines dades publica',
  __API__: `https://${values.domini}/TODO`,
  __LLICENCIA__: `https://${values.domini}/TODO-llicencia`,
};
/** Al codi, els valors van dins de cometes: s'escapen perquè un apòstrof no el trenqui. */
const omple = (text: string, codi: boolean) =>
  text.replace(/__[A-Z_]+__/g, (clau) => {
    const valor = valors[clau];
    if (valor === undefined) throw new Error(`La plantilla té ${clau}, que no té valor.`);
    return codi ? valor.replace(/[\\'"`$]/g, '\\$&') : valor;
  });

const nous = {
  [`src/${nom}.ts`]: 'plantilla/servidor.ts',
  [`src/${nom}.test.ts`]: 'plantilla/servidor.test.ts',
  [`docs/${nom}.md`]: 'plantilla/docs.md',
};
for (const desti of Object.keys(nous)) {
  const ja = await access(new URL(desti, arrel)).then(
    () => true,
    () => false,
  );
  if (ja) {
    console.error(`${desti} ja existeix.`);
    process.exit(1);
  }
}
for (const [desti, origen] of Object.entries(nous))
  await escriu(desti, omple(await llegeix(origen), desti.endsWith('.ts')));

const registre = await llegeix('src/servidors.ts');
await escriu(
  'src/servidors.ts',
  registre
    .replace(
      "import type { Fetch } from './comun.ts';",
      `import type { Fetch } from './comun.ts';\nimport { ${funcio} } from './${nom}.ts';`,
    )
    .replace(
      /\n\];\s*$/,
      `
  {
    nom: '${nom}',
    organisme: ${JSON.stringify(values.organisme)},
    domini: ${JSON.stringify(values.domini)},
    llicencia: ${JSON.stringify(valors.__LLICENCIA__)},
    docs: 'docs/${nom}.md',
    proves: 'src/${nom}.test.ts',
    crea: ${funcio},
  },
];
`,
    ),
);

const paquet = JSON.parse(await llegeix('package.json'));
paquet.scripts[nom] = `node src/index.ts ${nom}`;
await escriu('package.json', `${JSON.stringify(paquet, null, 2)}\n`);

const readme = await llegeix('README.md');
await escriu(
  'README.md',
  readme.replace(
    /(^\| \[`[a-z-]+`\]\(docs\/[a-z-]+\.md\).*\n)(?!\| \[`)/m,
    `$1| [\`${nom}\`](docs/${nom}.md) | TODO: la font, amb l'enllaç | TODO: què s'hi pot preguntar |\n`,
  ),
);

console.log(`Fet. Ara:
- Omple cada TODO de src/${nom}.ts, src/${nom}.test.ts, docs/${nom}.md, src/servidors.ts i README.md.
- Si ${values.domini} no és a la taula de NEUTRALITAT.md, afegeix-l'hi i explica per què a la pull request.
- npm test, npm run typecheck i npm run format. Prova'l contra l'API real: node src/index.ts ${nom}`);
