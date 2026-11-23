# Finestra Oberta

[![CI](https://github.com/Gonvar/finestra-oberta/actions/workflows/ci.yml/badge.svg)](https://github.com/Gonvar/finestra-oberta/actions/workflows/ci.yml)

**Les dades i els tràmits de l'Administració catalana, més clars i a l'abast de tothom.**

[finestraoberta.cat](https://finestraoberta.cat) · [Català](#finestra-oberta) · [Castellano](#en-castellano) · [English](#in-english)

Finestra Oberta és una iniciativa oberta per fer més fàcil relacionar-se amb la Generalitat, els ajuntaments i els organismes públics de Catalunya. Comencem connectant assistents d'IA amb les dades obertes oficials, sempre amb la font i la data de les dades.

**Projecte independent, sense vinculació amb cap administració. És experimental.**

## Crèdits

La idea i bona part de l'enfocament venen de [Reforma Digital](https://github.com/samuelcorsan/reforma-digital), la iniciativa comunitària per millorar les webs de l'Administració General de l'Estat. Finestra Oberta porta la mateixa idea a l'àmbit català. El codi adaptat d'aquell projecte ho indica a la capçalera del fitxer i es manté sota la seva llicència MIT (vegeu [LICENSE](LICENSE)).

## Servidors MCP

Un servidor [MCP](https://modelcontextprotocol.io) deixa que un assistent (Claude, ChatGPT, Cursor…) consulti una font de dades oficial. Les eines són només de lectura i cada resposta porta la font.

| Servidor                                 | Font                                                                                              | Què s'hi pot preguntar                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`idescat`](docs/idescat.md)             | [API Taules v2](https://www.idescat.cat/dev/api/taules/) de l'Institut d'Estadística de Catalunya | Població per comarca o municipi, naixements, PIB trimestral, usos lingüístics, afiliació…             |
| [`dades-obertes`](docs/dades-obertes.md) | [Dades obertes de Catalunya](https://analisi.transparenciacatalunya.cat), de la Generalitat       | Els conjunts dels departaments: accidents, salut, educació, medi ambient, contractació, pressupostos… |
| [`barcelona`](docs/barcelona.md)         | [Open Data BCN](https://opendata-ajuntament.barcelona.cat), de l'Ajuntament de Barcelona          | Barcelona per barri i districte: padró, qualitat de l'aire, soroll, equipaments, accidents…           |

Exemples de preguntes:

- Quantes dones vivien a Osona l'1 de gener de 2025?
- Com ha variat el PIB de Catalunya l'últim trimestre?
- Quina comarca va tenir més morts en accidents de trànsit el 2023?

A [docs/exemples.md](docs/exemples.md) hi ha aquestes preguntes resoltes amb les crides i les respostes reals dels servidors.

## El Govern i el Parlament

A la branca [`dades`](https://github.com/Gonvar/finestra-oberta/tree/dades) hi ha la composició del Govern, la del Parlament i la del ple de cada ajuntament els ajuts que encara es poden demanar i com va el pressupost de la Generalitat, en JSON, cadascuna amb la seva font i la data de les dades, i la còpia de cada resposta de les fonts oficials. Una tasca automàtica les actualitza cada dia i les signa. `npm run dades` les torna a generar des de les fonts i `npm run verifica-dades` comprova que no s'han retocat. Vegeu [docs/institucions.md](docs/institucions.md).

## Com fer-los servir

Cal **Node.js 24 o posterior**.

```sh
git clone https://github.com/Gonvar/finestra-oberta.git
cd finestra-oberta
npm install
```

Cada servidor s'executa per stdio amb el seu nom. Per afegir-los a Claude Code:

```sh
claude mcp add idescat -- node "$PWD/src/index.ts" idescat
claude mcp add dades-obertes -- node "$PWD/src/index.ts" dades-obertes
claude mcp add barcelona -- node "$PWD/src/index.ts" barcelona
```

En altres clients (Claude Desktop, Cursor…), configura un servidor stdio amb l'ordre `node` i els arguments `/camí/a/finestra-oberta/src/index.ts` i el nom del servidor:

```json
{
  "mcpServers": {
    "idescat": {
      "command": "node",
      "args": ["/camí/a/finestra-oberta/src/index.ts", "idescat"]
    }
  }
}
```

## Desenvolupament

**L'idioma del projecte és el català.** El codi, la documentació, els commits, les pull requests i les issues es fan en català.

```sh
npm test             # proves amb dades sintètiques
npm run typecheck    # TypeScript
npm run format       # Prettier
```

Node executa el TypeScript directament, sense compilar. Les proves fan servir dades sintètiques amb la forma de cada API: no substitueixen una comprovació contra l'API real.

- [CONTRIBUTING.md](CONTRIBUTING.md): com contribuir, com proposar un canvi i com afegir un servidor.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): el codi de conducta del projecte.
- [NEUTRALITAT.md](NEUTRALITAT.md): només fonts oficials, cap dada editada a mà i res que afavoreixi cap partit.
- [SECURITY.md](SECURITY.md): què fan els servidors amb les dades i com informar d'un problema.
- [DESIGN.md](DESIGN.md): el sistema de disseny de la web (colors, tipografia, components i to).
- [AGENTS.md](AGENTS.md): instruccions per als agents d'IA que hi treballen.

## Properes fonts

- Parlament de Catalunya: diputats, iniciatives i votacions
- DOGC: disposicions i normativa

## Llicència

[MIT](LICENSE).

---

## En castellano

Finestra Oberta conecta asistentes de IA con los datos abiertos oficiales de Cataluña: las estadísticas del Idescat, los conjuntos de datos de la Generalitat y los del Ajuntament de Barcelona, mediante servidores MCP de solo lectura que citan siempre la fuente y la fecha de los datos. Se inspira en [Reforma Digital](https://github.com/samuelcorsan/reforma-digital). **El idioma del proyecto es el catalán**: la documentación y las contribuciones están en catalán, pero puedes abrir una issue en castellano.

## In English

Finestra Oberta connects AI assistants to Catalonia's official open data, Idescat statistics, Generalitat datasets and Barcelona City Council data, through read-only MCP servers that always cite the source and the date of the data. It is inspired by [Reforma Digital](https://github.com/samuelcorsan/reforma-digital). **The project's language is Catalan**: documentation and contributions are in Catalan, but you can open an issue in English.
