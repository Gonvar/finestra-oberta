# Les dades publicades, per a qualsevol assistent

Servidor MCP remot de les dades que Finestra Oberta publica cada dia a la branca [`dades`](https://github.com/Gonvar/finestra-oberta/tree/dades): el Govern, el Parlament, el ple de cada ajuntament, l'agenda, què ha decidit el Parlament, els ajuts, el pressupost, els contractes i els indicadors de cada municipi. Vegeu [institucions.md](institucions.md) per saber d'on surt cada fitxer.

```
https://finestraoberta.cat/mcp
```

No cal instal·lar res ni cap clau. Quan el workflow de dades publica dades noves, Cloudflare torna a compilar la web, i el servidor les serveix a la primera consulta següent.

## Com connectar-lo

**Claude Code**, com a plugin:

```sh
/plugin marketplace add Gonvar/finestra-oberta
/plugin install finestra-oberta@finestra-oberta
```

O directament, com a servidor:

```sh
claude mcp add --transport http finestra-oberta https://finestraoberta.cat/mcp
```

**Claude (web i escriptori), ChatGPT, Cursor i altres clients:** afegeix un connector o servidor MCP remot amb l'adreça `https://finestraoberta.cat/mcp`. No necessita autenticació.

## Les eines

1. **`llistar_conjunts`** diu quins conjunts hi ha, com `govern` o `ajuntaments`, i de cadascun la font, l'enllaç, la data i les notes, tal com les escriu el fitxer.
2. **`veure_estructura`** mostra els camps d'un conjunt o d'una part, sense les dades senceres: el tipus de cada camp, quants elements té cada llista i els valors curts.
3. **`consultar`** torna les dades d'un camí, com `consellers.3` o `municipis`. D'una llista en torna una pàgina (`desde`, `quants`, com a molt 100), en l'ordre de la font i amb l'índex de cada element. `cerca` tria els elements que contenen totes les paraules, sense accents ni majúscules, i `camp` diu en quin camp s'ha de mirar:

```json
{ "conjunt": "ajuntaments", "cami": "municipis", "cerca": "vic", "camp": "nom" }
```

En una llista gran (de més de 200 kB, com `municipis` de `mapa-municipis` o `convocatories` d'`ajuts`), `cerca` necessita `camp`, i només es pot cercar en els camps de text o de nombres, no en els que són objectes o llistes.

Les eines no fan càlculs ni resums: els valors arriben tal com són al fitxer publicat. Els càlculs que hi hagi els ha fet el workflow de dades, i la nota de cada conjunt ho diu. Un conjunt nou que afegeixi el workflow de dades surt a `llistar_conjunts` sense canviar el servidor.

## Font i verificació a cada resposta

Cada resposta porta:

- **`fonts`**: els camps del fitxer que diuen d'on surten les dades (`font`, `url`, `data_dades`, `data_consulta`, `nota`…), sense canviar-los.
- **`data_consulta`**: el dia en què el workflow va llegir les fonts. Si `fonts` no diu la data de les dades, la data de cada valor és dins del conjunt, com l'any de cada indicador a `municipis`.
- **`verificacio`**: l'adreça del fitxer a `https://finestraoberta.cat/dades/`, la seva empremta SHA-256 tal com la signa `procedencia.json`, i l'enllaç a [com comprovar que les dades són de la font](institucions.md#com-comprovar-que-les-dades-són-de-la-font).

La web publica a `/dades/` els fitxers de la branca `dades` byte a byte, i el build falla si l'empremta d'algun no és la que diu `procedencia.json`. Qualsevol persona pot descarregar-los i comparar-ne l'empremta:

```sh
curl -s https://finestraoberta.cat/dades/govern.json | sha256sum
curl -s https://finestraoberta.cat/dades/procedencia.json | jq -r '.fitxers["govern.json"]'
```

## Com es llegeixen els fitxers

El pla gratuït de Cloudflare Workers dona 10 ms de CPU per petició, i analitzar un fitxer sencer ja en passa: `mapa-municipis.json` fa 13 MB. Per això el build de la web parteix cada fitxer de `/dades/` en trossos a `/conjunts/`:

- `/conjunts/<conjunt>.json`: la font, la verificació, l'estructura i la llista dels camps del primer nivell.
- `/conjunts/<conjunt>/<camp>.json`: cada camp del primer nivell.
- `/conjunts/<conjunt>/<camp>/<pàgina>.json`: les llistes de més de 200 kB, en pàgines d'uns 100 kB, i a `cerca/<camp>.json` el text de cada element en aquell camp, per cercar-hi.

Una consulta només llegeix els trossos que necessita. Els trossos es fan en el mateix build que comprova les empremtes, i no canvien cap valor ni l'ordre: la verificació es fa sempre sobre els fitxers de `/dades/`.

## Límits

- **Una resposta té com a molt 60.000 caràcters**, perquè hi càpiga al context d'un assistent. Si n'hi ha més, el servidor torna un error que diu com demanar-ne menys: un camí més concret o menys elements.
- **Les dades són les de l'última publicació.** La data de cada font és a `fonts`. La web es torna a compilar després de cada publicació, i fins aleshores el servidor serveix les anteriors.

## Com provar-lo

```sh
cd web
npm run build
npx wrangler dev
claude mcp add --transport http finestra-oberta-local http://localhost:8787/mcp
```

El codi és a [web/src/mcp/](../web/src/mcp/) i [web/src/worker.ts](../web/src/worker.ts). `npm test` a `web/` el prova amb dades sintètiques i amb crides MCP de veritat al Worker.
