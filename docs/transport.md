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

## Històric i pàgina «Com van els trens»

El workflow [`transport.yml`](../.github/workflows/transport.yml) fa una foto cada mitja hora (als minuts 7 i 37) i la publica a [historic.finestraoberta.cat](https://historic.finestraoberta.cat), un bucket R2 de Cloudflare de lectura pública. La pàgina [finestraoberta.cat/transport](https://finestraoberta.cat/transport/) en llegeix el resum des del navegador, perquè la web només es compila un cop al dia.

Cada foto ([src/foto-transport.ts](../src/foto-transport.ts)) llegeix les mateixes fonts que les eines `retards` i `avisos`: el GTFS-RT de Renfe, el Geotren d'FGC i els avisos de metro i de bus de TMB.

| Fitxer                                      | Què hi ha                                                                                                                                  | Quant temps es guarda   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `captures/AAAA-MM-DD/HHMMSS-<font>.json.gz` | Els bytes de la resposta de cada font, comprimits i tal com van arribar                                                                    | 30 dies                 |
| `fotos/AAAA-MM-DD/HHMMSS.json`              | Els trens de cada línia i el seu retard, amb l'empremta SHA-256 de cada còpia                                                              | 30 dies                 |
| `dies/AAAA-MM-DD.json`                      | El dia acumulat, tren a tren: el retard més gran de cada tren de Rodalies, si algun cop un tren d'FGC no anava en hora i els avisos de TMB | Per sempre              |
| `resum.json`                                | El que llegeix la web: l'última foto i el resum dels últims 30 dies                                                                        | Es reescriu a cada foto |

- **Un tren compta un cop per dia.** De Rodalies, «amb retard» vol dir que en alguna foto portava 5 minuts o més. D'FGC, que en alguna foto no anava en hora.
- **Un tren de Rodalies que en alguna foto surt cancel·lat compta com a cancel·lat**, i no també com a tren en circulació.
- **Un tren sense dada no compta al total.** Si Renfe no en publica el retard, o FGC no diu si va en hora, el tren no pot sumar a la part amb retard. Si comptés al total, faria semblar la línia més puntual. Es dona a part (`sense_retard_publicat`, `sense_dada`).
- **Si `resum.json` no hi és però sí que hi ha dies publicats, el workflow s'atura** en lloc de començar un resum nou només amb avui.
- **Si FGC no respon, la foto es fa igual amb Rodalies i TMB.** L'API d'FGC no respon cada nit entre la 1:00 i les 3:00. La foto ho diu a `fgc.no_ha_respost`, amb l'error, no en desa cap còpia, i el dia no hi afegeix cap tren d'FGC. El workflow ho marca com a avís. Si no respon Rodalies o TMB, o FGC respon una cosa que no s'entén, la foto falla.
- **Les còpies es desen tal com van arribar, byte a byte.** Una resposta que no és UTF-8 és un error.
- **El workflow no instal·la cap paquet de tercers.** La foto només fa servir `src/historic.ts` i `src/operadors.ts`, que no tenen dependències. Cada clau només arriba als passos que la necessiten. Si la clau de TMB surt en algun fitxer que s'havia de publicar, no es publica res.
- **Els dies van pel dia a Catalunya**, no pel dia en UTC.
- **La web no mostra el percentatge d'una línia amb menys de 10 trens** en el període, perquè exageraria: 2 de 2 seria un 100 %.
- **Qui llança la foto és el cron del Worker de la web** ([`web/wrangler.jsonc`](../web/wrangler.jsonc) i [`web/src/worker.ts`](../web/src/worker.ts)), amb l'API `workflow_dispatch` de GitHub. El `schedule` de GitHub no s'havia disparat mai en aquest repositori: el 23 de novembre de 2026 només hi havia les dues fotos llançades a mà. Si GitHub no accepta la crida, l'error queda als registres del Worker i aquella foto falta.
- **El token del Worker** és el secret `GITHUB_TOKEN` del Worker (`wrangler secret put GITHUB_TOKEN`): un token _fine-grained_ limitat a aquest repositori amb el permís _Actions: Read and write_ i res més.
- **Les claus** de TMB (`TMB_APP_ID`, `TMB_APP_KEY`) i d'R2 (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`) són secrets de l'entorn `dades` de GitHub, que només s'obre per a `main`. L'adreça de TMB es desa sense la clau.

### Com comprovar una foto

Cada execució signa la foto, el dia i el resum amb una atestació de GitHub. Per comprovar una foto dels últims 30 dies, baixa-la amb les seves còpies, amb la mateixa estructura de carpetes, i executa:

```sh
node src/verifica-foto.ts <carpeta> fotos/2026-11-23/093712.json
gh attestation verify <carpeta>/fotos/2026-11-23/093712.json --repo Gonvar/finestra-oberta
```

El primer torna a fer la foto a partir de les còpies i comprova que surt igual, i que cada còpia té la seva empremta. El segon comprova que la foto la va publicar el workflow de `main`.

## Reutilització

- **Renfe**: la [informació legal de data.renfe.com](https://data.renfe.com/legal) permet reutilitzar les dades, també amb finalitats comercials, si se'n cita l'origen (Renfe Operadora) i la data de l'última actualització. Cada conjunt indica, a més, la seva llicència (CC BY 4.0 a [incidencias-avisos](https://data.renfe.com/dataset/incidencias-avisos)).
- **FGC**: cada conjunt de [dadesobertes.fgc.cat](https://dadesobertes.fgc.cat) indica la seva llicència, CC BY 4.0, que les instruccions del servidor demanen citar.
- **TMB**: les condicions d'ús de l'API són a [developer.tmb.cat](https://developer.tmb.cat).

## Proves

- [src/transport.test.ts](../src/transport.test.ts): proves sense xarxa amb dades sintètiques amb la forma de cada API.
- [src/historic.test.ts](../src/historic.test.ts) i [web/src/dades/transport.test.ts](../web/src/dades/transport.test.ts): l'històric i la pàgina, amb dades sintètiques.
- L'històric s'ha comprovat contra les fonts reals el 23 de novembre de 2026: dues fotos seguides, la segona sobre el resum de la primera, i `verifica-foto.ts`. No s'ha provat la pujada a R2, que només fa el workflow de `main`.
- Comprovat contra les APIs reals per stdio el 23 de novembre de 2026: els retards de Rodalies i d'FGC, els avisos dels tres operadors, la cerca d'estacions dels tres operadors, les línies d'FGC, els horaris de Sarrià (i «Sarria» sense accent, que falla amb el motiu), els propers metros a Catalunya i busos a la parada 108, una crida amb estació i parada alhora, la demanda de Sant Cugat el 2024 i de Sants, una estació inexistent, TMB sense clau i TMB amb una clau falsa (401).
