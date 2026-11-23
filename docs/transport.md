# Transport públic

Servidor MCP amb les dades obertes dels operadors de transport públic:

- **Rodalies de Catalunya**: el [GTFS Realtime de Renfe](https://data.renfe.com/dataset/incidencias-avisos) en JSON (`gtfsrt.renfe.com`) i el portal CKAN [data.renfe.com](https://data.renfe.com), sense clau. Llicència CC BY 4.0, la que indica cada conjunt.
- **Ferrocarrils de la Generalitat de Catalunya**: el portal Opendatasoft [dadesobertes.fgc.cat](https://dadesobertes.fgc.cat), sense clau. Llicència CC BY 4.0, la que indica cada conjunt.
- **TMB**: l'[API de TMB](https://developer.tmb.cat), amb una clau gratuïta. Les condicions d'ús són a [developer.tmb.cat](https://developer.tmb.cat).

```sh
TMB_APP_ID=… TMB_APP_KEY=… node src/index.ts transport
```

Sense `TMB_APP_ID` i `TMB_APP_KEY`, les eines de Rodalies i d'FGC funcionen igual, i les de TMB responen que falta la clau. La clau es demana a [developer.tmb.cat](https://developer.tmb.cat), i el filtre de _referrer_ s'ha de deixar buit, perquè el servidor no envia cap `Referer`.

## Eines

1. **`retards`** (`rodalies` o `fgc`): els trens que circulen ara mateix, per línia.
   - De Rodalies: quants n'hi ha, quants s'han cancel·lat, quants porten 5 minuts o més de retard, i el retard mitjà i el màxim, en minuts, tal com el publica Renfe.
   - D'FGC: quants van en hora i quants no, segons el camp `en_hora` del Geotren. FGC no en publica els minuts.
2. **`avisos`** (`rodalies`, `fgc` o `tmb`): les incidències vigents, amb les línies i les estacions afectades i el text de l'operador.
3. **`estacions`** (`rodalies`, `fgc` o `tmb`, i `q`): les estacions el nom de les quals conté les paraules de la cerca. De TMB, també les parades de bus, amb el codi que fa servir `propers_tmb`.
4. **`linies_fgc`**: les línies d'FGC i el seu recorregut.
5. **`horaris_fgc`** (`estacio` i `des_de`): els trens previstos avui en una estació d'FGC a partir d'una hora.
6. **`propers_tmb`** (`metro` o `parada_bus`): els minuts que falten per als propers metros d'una estació, per línia i direcció, o per als propers busos d'una parada.
7. **`demanda`** (`rodalies` o `fgc`, `estacio` i `any`): els viatgers per estació. De Rodalies, per franja de mitja hora, del 2018. D'FGC, per mes, del 2019 al 2024.

## Comportament de les fonts que el servidor té en compte

- **El feed de Renfe és de tot l'Estat.** Els dos primers dígits de l'identificador d'un viatge (`5126L28416R2N`) o d'una ruta (`51T0025R2`) són el nucli de rodalies, i el 51 és el de Barcelona. Al final hi ha la línia (`R2N`). Primer es mira el nucli. Un identificador del nucli 51 amb una altra forma és un error, i no es descarta en silenci, ni als retards ni als avisos. El d'un altre nucli no afecta Rodalies.
- **Els avisos d'estació de Renfe no diuen el nucli.** Es reconeixen amb la llista d'estacions de Rodalies que publica Renfe, que és del 2019. Un avís d'una estació oberta després no surt.
- **Les dates de les dades de Renfe surten del portal.** El dia de la llista d'estacions és el de l'última actualització del recurs a data.renfe.com, i l'any de la demanda surt de la descripció del conjunt («año 2018»). Si no hi és, és un error.
- **Un mateix avís de Renfe surt repetit** quan afecta moltes rutes. S'ajunta per l'identificador.
- **Els avisos de Renfe porten dos textos marcats com a castellà**, i el segon sovint és en català. Es donen tots dos, tal com són.
- **Renfe publica retards negatius** (trens avançats). Es compten a la mitjana tal com arriben, i el criteri ho diu.
- **El llindar de 5 minuts és una tria del servidor**, no de Renfe. Per això va al nom del camp, i el retard mitjà i el màxim es donen igualment.
- **FGC no publica les seves incidències en un format llegible sense dependències.** Les alertes GTFS-RT d'FGC són en protobuf i són sobretot observacions de cada tren («dos primers cotxes reservats escolars»). El servidor llegeix el conjunt `avisos`, que pot ser buit.
- **L'accessibilitat d'FGC segueix GTFS:** 1 és accessible, 2 no accessible i 0 sense informació. Si les andanes d'una estació diuen coses diferents, la resposta diu «segons l'andana».
- **Passada la mitjanit, FGC encara publica els horaris del dia de servei anterior**, que escriuen les 00.35 com a `24:35`. Si els horaris són d'un dia anterior al d'avui, l'hora demanada es compara sumant-hi 24 hores.
- **ODSQL, el llenguatge de consulta d'FGC, no compara hores escrites com a text.** El servidor es baixa els horaris del dia d'una estació i els filtra ell mateix. GTFS escriu les hores de després de mitjanit com a `24:10`.
- **Els codis de les estacions de metro de TMB són per línia**: Catalunya és el 126 a la L1 i el 326 a la L3. El servidor demana totes les línies de l'estació.
- **Els textos dels avisos de TMB porten HTML** (`<br>`). Se'n treuen les etiquetes. Una entitat HTML que no es coneix és un error, com a la resta de fonts: no es pot endevinar quin caràcter és. El 23/11/2026 cap avís de TMB en portava.
- **Un codi de parada de bus que no existeix** torna la mateixa resposta que una parada sense cap bus previst. El servidor ho diu a la nota.

## Proves

- [src/transport.test.ts](../src/transport.test.ts): proves sense xarxa amb dades sintètiques amb la forma de cada API.
- Comprovat contra les APIs reals per stdio el 23 de novembre de 2026: els retards de Rodalies i d'FGC, els avisos dels tres operadors, la cerca d'estacions dels tres operadors, les línies d'FGC, els horaris de Sarrià (i «Sarria» sense accent, que falla amb el motiu), els propers metros a Catalunya i busos a la parada 108, una crida amb estació i parada alhora, la demanda de Sant Cugat el 2024 i de Sants, una estació inexistent, TMB sense clau i TMB amb una clau falsa (401).
