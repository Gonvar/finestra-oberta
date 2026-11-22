# Finestreta Oberta

**Les dades i els tràmits de l'Administració catalana, més clars i a l'abast de tothom.**

Finestreta Oberta és una iniciativa oberta per fer més fàcil relacionar-se amb la Generalitat, els ajuntaments i els organismes públics de Catalunya. Comencem connectant assistents d'IA amb les dades obertes oficials, sempre amb la font citada.

**Projecte independent, sense vinculació amb cap administració. És experimental.**

## Crèdits

La idea i bona part de l'enfocament venen de [Reforma Digital](https://github.com/samuelcorsan/reforma-digital), la iniciativa comunitària per millorar les webs de l'Administració General de l'Estat. Finestreta Oberta porta la mateixa idea a l'àmbit català. El codi adaptat d'aquell projecte ho indica a la capçalera del fitxer i es manté sota la seva llicència MIT (vegeu [LICENSE](LICENSE)).

## Servidors MCP

Un servidor [MCP](https://modelcontextprotocol.io) deixa que un assistent (Claude, ChatGPT, Cursor…) consulti una font de dades oficial. Les eines són només de lectura i cada resposta porta la font.

| Servidor   | Font                                                                      | Què s'hi pot preguntar                                                                                |
| ---------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Idescat** | [API Taules v2](https://api.idescat.cat/taules/v2) de l'Institut d'Estadística de Catalunya | Població per comarca o municipi, naixements, PIB trimestral, usos lingüístics, afiliació… |

Exemples:

- Quantes dones vivien a Osona l'1 de gener de 2025?
- Quina població té Vic?
- Com ha variat el PIB de Catalunya l'últim trimestre?

### Com fer-lo servir

Cal **Node.js 22.18 o posterior**.

```sh
npm install
npm run idescat    # servidor MCP per stdio
```

Per afegir-lo a Claude Code:

```sh
claude mcp add idescat -- node /camí/a/finestreta-oberta/src/index.ts
```

## Desenvolupament

```sh
npm test           # proves amb dades sintètiques
npm run typecheck
```

Node executa el TypeScript directament, sense compilar: només s'hi pot fer servir sintaxi que es pugui esborrar (`erasableSyntaxOnly`) i els imports porten l'extensió `.ts`.

Les proves fan servir dades sintètiques amb la forma de l'API. No substitueixen una comprovació contra l'API real.

## Properes fonts

- [Dades obertes de la Generalitat](https://analisi.transparenciacatalunya.cat) (API Socrata)
- Parlament de Catalunya: diputats, iniciatives i votacions
- DOGC: disposicions i normativa
- [Open Data BCN](https://opendata-ajuntament.barcelona.cat)
