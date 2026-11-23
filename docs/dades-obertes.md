# Dades obertes de Catalunya

Servidor MCP del portal de [Dades obertes de Catalunya](https://analisi.transparenciacatalunya.cat), de la Generalitat. És una plataforma [Socrata](https://dev.socrata.com), pública i sense clau. Cada conjunt de dades té columnes i es consulta amb [SoQL](https://dev.socrata.com/docs/queries/), un SQL reduït que executa l'API.

```sh
node src/index.ts dades-obertes
```

## Eines

1. **`cercar_conjunt`** busca conjunts per paraules. De cadascun dona l'identificador (com `rmgc-ncpb`), l'organisme que el publica, la categoria, la freqüència anunciada i la data de les dades.
2. **`veure_conjunt`** mostra les columnes: el nom de camp per a SoQL, el tipus, la descripció, el mínim i el màxim i, de les columnes de text, els valors més freqüents.
3. **`consultar_dades`** executa una consulta SoQL de fins a 1.000 files:

```json
{
  "conjunt": "rmgc-ncpb",
  "select": "nomcom, count(*) as n, sum(f_morts) as morts",
  "where": "any = 2023",
  "group": "nomcom",
  "order": "morts desc",
  "limit": 3
}
```

## Comportament de l'API que el servidor té en compte

- **Un text mal escrit al `where` no dona cap error.** `nomcom = 'osona'`, en minúscules, torna zero files, o un `count(*)` de `"0"`, que semblen una dada real. Quan passa amb un filtre de text, la resposta porta un avís que explica com consultar els valors exactes.
- **La freqüència anunciada no és la data de les dades.** El conjunt d'accidents diu que s'actualitza cada any, però el novembre de 2026 les seves dades arriben fins al 2023. Cada resposta porta `dades_actualitzades`.
- **El catàleg barreja conjunts federats d'altres portals**, com el de L'Hospitalet, que en aquest domini responen 404. La cerca es limita a `analisi.transparenciacatalunya.cat`.
- **Els errors de SoQL s'expliquen a l'assistent** (per exemple, «No such column: nope») perquè pugui corregir la consulta. El missatge es talla abans de la consulta interna que hi afegeix l'API.
- **Un conjunt que no existeix** es diu com a tal, perquè l'assistent no l'inventi.
- **Si arriben tantes files com el límit,** la resposta avisa que pot haver-n'hi més i que no és el total.
- **Els números i les dates arriben com a text** (`"n": "331"`). Les instruccions ho diuen a l'assistent.
- **`veure_conjunt` només mostra els valors més freqüents.** Per veure'ls tots cal agrupar-los amb `$group`.
- **Sense `$order`, les pàgines d'`offset` poden repetir o saltar files.**

## Reutilització

Les metadades de cada conjunt (`attributionLink`) remeten a la [Llicència oberta d'ús d'informació - Catalunya](https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies). Permet reutilitzar, distribuir i transformar la informació, però no se'n pot alterar el contingut ni desnaturalitzar-ne el sentit, cal citar la font i cal dir la data de l'última actualització. Un conjunt pot tenir una llicència pròpia, que preval. Per això `cercar_conjunt` i `veure_conjunt` donen l'organisme que publica cada conjunt i la data de les seves dades (`dades_actualitzades`), i les instruccions demanen a l'assistent que les citi.

## Proves

- [src/dadesobertes.test.ts](../src/dadesobertes.test.ts): proves amb dades sintètiques.
- Comprovat contra l'API real per stdio el 22 de novembre de 2026: una cerca d'accidents, els morts per comarca el 2023, el recompte d'Osona, l'avís del zero amb un text mal escrit, una columna inexistent, un conjunt inexistent i l'avís del límit.
