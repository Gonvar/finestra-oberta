# El Govern, el Parlament, els ajuntaments, els municipis, les eleccions municipals, el mapa, els ajuts i el pressupost

Les dades que es publiquen cada dia: qui forma el Govern, què en publica el Portal de la Transparència, com es reparteixen els 135 escons del Parlament, qui forma el ple de cada ajuntament, uns quants indicadors de cada municipi i com s'hi va votar a les últimes municipals, els ajuts i les subvencions que encara es poden demanar i com va el pressupost de la Generalitat. Són en JSON a la branca [`dades`](https://github.com/Gonvar/finestra-oberta/tree/dades), perquè la web les pugui mostrar sense consultar les fonts. El codi que les genera és a `main`.

```sh
npm run dades
```

L'script ho llegeix i ho comprova tot abans d'escriure res. Si una comprovació falla, surt amb un error i deixa els fitxers com estaven. Per això es pot executar sense ningú al davant. Escriu a `dades/`, que no forma part de `main`.

## Actualització automàtica

La tasca [`dades.yml`](../.github/workflows/dades.yml) s'executa cada dia a les 5.00 UTC i cada vegada que a main canvia `src/` o `fonts/`, perquè la web necessita les dades amb la forma que dona el codi nou. També es pot llançar a mà des de la pestanya Actions de GitHub.

- Primer comprova que el que hi ha publicat a `dades` encara es pot reproduir. Després executa `npm run dades` i comprova que el resultat nou també es pot reproduir a partir de les còpies de les fonts.
- Si la composició ha canviat, o si el que hi ha publicat ja no es pot reproduir, signa `procedencia.json` amb una atestació i en fa un commit a `dades`. El missatge del commit enllaça l'execució de la tasca.
- Si l'únic canvi és `data_consulta`, no fa cap commit: la composició és la mateixa.
- Si una font falla o una comprovació no quadra, la tasca falla, GitHub ho notifica i `dades` es queda com estava. Aleshores cal mirar-ne el registre i corregir la causa.
- Llançada des d'una branca que no és `main`, la tasca llegeix les fonts i ho comprova tot, però no signa ni publica res. Serveix per provar un canvi abans de fusionar-lo.

Les dades no passen per pull request perquè no les escriu cap persona. El codi que les genera sí: un ruleset de `main` hi impedeix el push directe, el force push i l'esborrat, i tot canvi hi entra per una pull request pública, també els de qui administra el repositori.

### Qui pot escriure a `dades`

Ho decideix GitHub, no el workflow, que qualsevol branca podria canviar:

- Un ruleset de la branca `dades` hi impedeix el push, el force push i l'esborrat. L'única excepció són les claus de desplegament del repositori, i el repositori només en té una, la del workflow. No hi té excepció ningú més, tampoc qui administra el repositori.
- La clau privada és un secret de l'entorn `dades` de GitHub, i aquest entorn només s'obre per a execucions de la branca `main`. Una execució des d'una altra branca no la pot llegir.

- El job que publica comprova que el seu commit encara és el cap de `main` i que les fonts s'han consultat després de les dades publicades. Així, tornar a executar una execució antiga no torna a publicar dades velles.

Per tant, a `dades` només hi pot escriure el workflow de `main`, i el codi de `main` només canvia amb una pull request pública.

## Com comprovar que les dades són de la font

Al costat de cada JSON hi ha:

- `captures/`: la resposta de cada font oficial tal com va arribar, sense cap canvi. Cada fitxer es diu com la seva empremta SHA-256.
- `procedencia.json`: l'empremta de cada JSON publicat i, de cada resposta, l'URL demanat, l'URL que la va servir després de les redireccions, l'hora de la consulta, el codi HTTP, el tipus de contingut i l'empremta, en l'ordre en què es van demanar.

L'atestació signa `procedencia.json`. Com que aquest fitxer porta l'empremta dels JSON i de cada còpia, els signa tots alhora: no es poden barrejar fitxers de dues execucions.

Hi ha tres comprovacions, i les pot fer qualsevol persona. Cal [`gh`](https://cli.github.com/), Git i Node.js 24.

**1. Les ha generat la tasca automàtica de `main`, i no una persona.** Cada actualització porta una [atestació de GitHub](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations) que diu quin workflow, quin commit de `main` i quina execució han produït `procedencia.json`. Es desa al registre públic de [Sigstore](https://www.sigstore.dev/), que no controla aquest projecte i on no es pot esborrar res.

```sh
git clone https://github.com/Gonvar/finestra-oberta.git
cd finestra-oberta
git clone --branch dades https://github.com/Gonvar/finestra-oberta.git dades
gh attestation verify dades/procedencia.json --repo Gonvar/finestra-oberta \
  --signer-workflow Gonvar/finestra-oberta/.github/workflows/dades.yml --source-ref refs/heads/main
```

Si algú hagués canviat `procedencia.json` a mà, no hi hauria cap atestació amb la seva empremta.

**2. Les dades surten de les còpies, sense retocs.** Torna a generar els JSON a partir de `captures/` amb el codi que diu l'atestació, i comprova que surten idèntics, byte a byte, i que cada fitxer té l'empremta que diu `procedencia.json`. El commit es treu de l'atestació, i no del missatge del commit, perquè l'atestació no la pot triar qui publica:

```sh
CODI=$(gh attestation verify dades/procedencia.json --repo Gonvar/finestra-oberta \
  --signer-workflow Gonvar/finestra-oberta/.github/workflows/dades.yml --source-ref refs/heads/main \
  --format json --jq '.[0].verificationResult.signature.certificate.sourceRepositoryDigest')
git checkout "$CODI"
npm run verifica-dades
```

Cal el codi amb què es van generar, perquè un canvi posterior pot demanar les fonts d'una altra manera. També cal la versió de Node que diu `node` a `procedencia.json`: l'ordre alfabètic dels grups, dels departaments i dels municipis depèn de la versió.

**3. La font encara diu el mateix.** Executa `npm run dades -- /tmp/ara` pel teu compte i compara `/tmp/ara/govern.json`, `/tmp/ara/parlament.json`, `/tmp/ara/ajuntaments.json`, `/tmp/ara/municipis.json`, `/tmp/ara/eleccions-municipals.json`, `/tmp/ara/mapa-municipis.json`, `/tmp/ara/activitat.json`, `/tmp/ara/ajuts.json` i `/tmp/ara/pressupost.json` amb els publicats. Si la composició ha canviat des de l'última actualització, la diferència ha de ser la d'aquest canvi. Aquesta comprovació també detecta unes dades antigues tornades a publicar, que passarien les dues primeres.

### Què no demostra

- Que la font oficial digui la veritat. Les dades són les que va publicar la font aquell dia. Si la font s'equivoca, l'error hi és.
- Que la resposta vingués del servidor oficial. HTTPS no signa les respostes, i el que es pot provar és que la tasca automàtica, executant un codi públic, va rebre aquests bytes en connectar-se a l'URL oficial.
- Qui administra el repositori pot canviar el ruleset, l'entorn o el workflow. Un canvi al workflow queda a la història de `main`, i un fitxer que no surt d'una execució del workflow de `main` no té atestació. Un canvi al ruleset o a l'entorn no és públic: si algú el fes servir per tornar a publicar dades antigues, ho detectaria la comprovació 3.

## `govern.json`

- **Font:** la [relació d'alts càrrecs dels departaments](https://analisi.transparenciacatalunya.cat/d/x9au-abcn) (`x9au-abcn`), que publica la Secretaria d'Administració i Funció Pública a Dades obertes de Catalunya.
- **Data:** `data_dades` és la data de l'última actualització del conjunt, no la del dia en què s'executa l'script.
- **Contingut:** el president i un conseller o consellera per departament, amb el nom, el càrrec, el departament i la retribució anual prevista en euros (`retribucio_anual`).
- **Noms:** la relació els escriu en majúscules i, en alguns casos, sense accents: «PANE MENA, OLGA». El nom ben escrit, «Olga Pané i Mena», surt de les [intervencions del Govern al Parlament](https://analisi.transparenciacatalunya.cat/d/7chp-hkce) (`7chp-hkce`), que té la seva pròpia data (`data_noms`). Totes les paraules del nom oficial han de ser al nom escrit, i ha de coincidir amb un sol nom.
- **Càrrecs:** «Consellera de Salut» es forma amb el sexe i el departament que dona la relació. Tal com els escriu la relació, el nom i el càrrec són a `nom_oficial` i `carrec_oficial`.
- **Comprovacions:**
  - Hi ha d'haver un president, i cada departament ha de tenir un conseller, i només un.
  - Cada persona ha de tenir un nom, i només un, a les intervencions. Una persona que encara no ha intervingut al Parlament atura l'script fins que s'hi afegeixi.
- **Foto i currículum:** `foto` i `cv` surten de les fitxes del [Consell Executiu](https://govern.cat/gov/consell-executiu) a govern.cat, copiades a `fonts/perfils-govern.json`. `data_perfils` és el dia en què es van copiar. `foto` és l'enllaç a la foto oficial, sense cap còpia, i `cv` són els paràgrafs del currículum en text pla. Cada membre es troba pel càrrec i els cognoms, i ha de coincidir amb una sola fitxa, amb una sola foto principal i amb un currículum que no sigui buit. Si algú no hi és, l'script s'atura. Segons l'[avís legal](https://govern.cat/gov/avis-legal) de govern.cat, els continguts són CC0. Igualment es mostra d'on surten.

### Com es copien les fitxes de govern.cat

govern.cat no respon als scripts: la seva API, al darrere de CloudFront, torna 403 a qualsevol petició que no vingui d'un navegador, també des d'un ordinador personal. Per això les fitxes es copien a mà, i cal tornar-ho a fer quan canvia el Govern (l'script s'atura si un membre no hi és):

1. Obre <https://govern.cat/gov/consell-executiu> al navegador i, a la consola de les eines de desenvolupament, enganxa:

   ```js
   const r = await (await fetch('/gov/api/v1/consell-executiu?size=100')).json();
   const fitxes = r.content.map((f) => ({
     nom: f.consellerIdioma.nom,
     carrec: f.consellerIdioma.carrec,
     fotos: f.audiovisual.filter((a) => a.tipusImatge === 1).map((a) => a.data),
     cv: f.consellerIdioma.descripcioCV,
   }));
   const desats = {
     consultat: new Date().toISOString().slice(0, 10),
     total: r.totalElements,
     fitxes,
   };
   const enllac = document.createElement('a');
   enllac.download = 'perfils-govern.json';
   enllac.href = URL.createObjectURL(new Blob([JSON.stringify(desats, null, 2)]));
   enllac.click();
   ```

2. Mou el fitxer `perfils-govern.json` que s'ha descarregat a `fonts/` i obre una pull request que digui quan es va copiar. La tasca de dades el llegeix d'allà quan es fusiona. (La consola de govern.cat no té la funció `copy`, i per això es descarrega.)

Aquesta còpia no té resposta desada a `captures/`, i per això no es pot verificar com la resta: `font_perfils` i `data_perfils` de govern.json diuen d'on surt i quan es va copiar. Només es copien aquests quatre camps. L'API en dona d'altres, com qui va publicar cada fitxa, que no s'han de desar.

## `dades/transparencia.json`

El que la Generalitat publica de cada membre del Govern a més del càrrec i la retribució. Cada apartat porta la seva font i la data de l'última actualització del conjunt (`data_dades`).

- **Fonts**, totes a Dades obertes de Catalunya:
  - [Declaracions d'activitats públiques i privades](https://analisi.transparenciacatalunya.cat/d/vdss-2ppz) (`vdss-2ppz`), de la Secretaria d'Administració i Funció Pública.
  - [Agenda pública amb grups d'interès](https://analisi.transparenciacatalunya.cat/d/hd8k-y28e) (`hd8k-y28e`), de la Direcció General de Govern Obert.
  - [Viatges a l'estranger](https://analisi.transparenciacatalunya.cat/d/5kte-hque) (`5kte-hque`), de la Direcció General de Govern Obert.
- **Llicència:** la de les condicions d'ús de Dades obertes de Catalunya. Els conjunts no en donen cap altra («See Terms of Use»).
- **Contingut de cada persona:**
  - `nomenament`: la data de nomenament que dona la declaració d'activitats.
  - `activitats`: els apartats de la declaració que no diuen «N/A», amb la llista d'activitats. Cada apartat porta el nom del camp (`camp`) i, a `apartat`, la descripció que en fan les metadades del mateix conjunt, sense resumir-la.
  - `agenda`: quantes files amb grups d'interès té l'agenda des del nomenament (`contactes`), i les cinc últimes. La relació posa una fila per grup i no diu quines són d'una mateixa reunió, i per això es compten les files tal com les dona: una reunió amb tres grups compta tres vegades. No compten les files sense grup («-»), que la relació fa servir per dir que en un trimestre no n'hi ha hagut cap. Si un membre nomenat fa més de dos trimestres no té cap fila, ni tan sols «-», la tasca falla: vol dir que el nom o el càrrec ja no es troben, i un zero seria fals. Si encara no hi surt, la persona no té el camp `agenda`, en lloc d'un zero. La tasca també falla si l'agenda no té cap fila i el primer nomenament ja fa més de dos trimestres.
  - `viatges`: quants viatges a l'estranger hi ha des del nomenament, la suma de les despeses publicades (`despeses`, que no hi és si encara no n'hi ha cap), quants encara no en tenen (`sense_despeses`) i els cinc últims.
- **Com es troba cada persona:** pel nom oficial de la relació d'alts càrrecs, com amb els noms ben escrits. L'agenda i els viatges inclouen tots els alts càrrecs i els mandats anteriors, i per això només compten les files amb el càrrec de president o de conseller i a partir del nomenament.
- **Comprovacions:**
  - Cada membre del Govern ha de tenir una declaració d'activitats activa, i només una, amb tots els apartats.
  - Les dates i els imports han de tenir la forma esperada.
  - Les metadades de les declaracions han de tenir columnes «Activitat pública N» i «Activitat privada N», cadascuna amb descripció.
  - Cap consulta no pot omplir una pàgina sencera de resultats.
- **Despeses:** es publiquen quan s'han validat, i l'import d'un viatge pot incloure el de la comitiva.

## `parlament.json`

- **Font:** la [distribució d'escons](https://www.parlament.cat/web/composicio/distribucio-escons/index.html) del Parlament de Catalunya i la fitxa de cada persona diputada. El Parlament no té cap API amb la composició: les dades es llegeixen de les pàgines web.
- **Data:** el Parlament no publica quan va canviar la composició per última vegada. Per això `data_consulta` és el dia en què es van llegir les pàgines i hi va sortir la composició que hi ha al fitxer. Com que la tasca automàtica només desa els canvis, pot ser anterior a l'última comprovació.
- **Contingut:** la legislatura, els grups amb els escons, el color i els subgrups, i cada persona amb el càrrec, el grup, la circumscripció, la llista electoral, el partit, l'enllaç a la seva fitxa i l'enllaç a la seva foto.
- **Comprovacions:**
  - Hi ha d'haver 135 persones i 135 escons diferents.
  - Totes les còpies d'un escó al mapa han de coincidir.
  - Cada fitxa ha de donar la circumscripció.
  - Almenys una fitxa ha de donar la foto, i dues fitxes no poden donar la mateixa. Una persona que encara no té foto surt sense `foto`, i la composició s'actualitza igualment.
  - Si una fitxa dona el grup, ha de ser el mateix que diu el mapa.
  - Les fitxes han de donar una sola legislatura en curs.
- **Grups:** són els d'avui, que poden no coincidir amb els resultats de les eleccions.
- **Fotos:** `foto` és l'enllaç a la foto oficial al web del Parlament, a la mida mitjana (fins a 600 px pel costat llarg). No se'n desa cap còpia. L'[avís legal](https://www.parlament.cat/pcat/serveis-parlament/avis-legal) del Parlament en permet la reutilització si se'n cita la font, no se n'altera el sentit i no es presenten com una versió oficial ni avalada pel Parlament. Cal mostrar-les amb «Foto: Parlament de Catalunya». Les condicions també són al camp `fotos` del fitxer.
- **Posicions:** cada persona porta a `posicio` el punt on la situa el dibuix del mapa d'escons, que surt de `posicionsEscons` a [mapa-escons.js](https://www.parlament.cat/js/mapa-escons.js). La web dibuixa l'hemicicle amb aquests punts, de manera que la disposició dels grups a la sala és la del Parlament. Si un escó no hi té posició, l'script s'atura.
- **Colors:** cada grup porta el color amb què el pinta el mapa d'escons. Un color que no tingui la forma d'un color CSS atura l'script.
- **Subgrups:** el mapa mostra els membres d'un subgrup dues vegades, una amb el grup i una altra amb el subgrup. Es comptabilitzen al grup i, a més, al subgrup.

## `ajuntaments.json`

- **Fonts:** totes dues són de la Secretaria de Governs Locals i de Relacions amb l'Aran (Municat), a Dades obertes de Catalunya, amb la [llicència de dades obertes de la Generalitat](https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/).
  - La [composició dels plens](https://analisi.transparenciacatalunya.cat/d/nm3n-3vbj) (`nm3n-3vbj`): cada persona electa de cada ajuntament, amb el càrrec, l'àrea de govern, el partit, l'ordre al ple i la data del nomenament.
  - Les [dades generals dels ens locals](https://analisi.transparenciacatalunya.cat/d/6nei-4b44) (`6nei-4b44`): el nom del municipi, la comarca, la província, els habitants, l'any del padró i la web.
- **Data:** `data_dades` i `data_municipis` són la data de l'última actualització de cada conjunt. La freqüència que anuncia la composició dels plens és «variable».
- **Contingut:** tots els municipis de Catalunya, per ordre alfabètic, i de cadascun les persones del ple en l'ordre que dona la font (`ordre`). Només els ajuntaments: els consells comarcals, les diputacions i les entitats municipals descentralitzades queden fora pel tipus d'ens que dona la font, no per qui les forma.
- **Codi:** `codi` són les sis primeres xifres del codi de Municat, el codi del municipi de l'INE amb el dígit de control, el mateix que fa servir l'Idescat. És el que lliga les dues fonts.
- **Noms, càrrecs i partits:** tal com els escriu la font, també quan són en majúscules. Tots els municipis i totes les persones tenen els mateixos camps. Si la font no en dona un (els habitants, la web, o el nom, el càrrec, l'àrea, el partit o la data d'una persona), hi és amb `null`, igual per a tothom.
- **Comprovacions:**
  - Cada municipi del registre ha de tenir ple, i cada ple ha de ser d'un municipi del registre.
  - Un municipi només pot sortir una vegada al registre, i un codi no pot correspondre a dos ajuntaments.
  - Cada codi ha de tenir deu xifres, i els habitants, l'any i l'ordre han de ser nombres. Un municipi no pot tenir els habitants sense l'any del padró, ni al revés.
  - Cada municipi ha de tenir nom, comarca i província, i dues persones del mateix ple no poden tenir el mateix ordre.
- **Si falla:** com que els ajuntaments es generen amb el Govern i el Parlament, una comprovació que falla també atura l'actualització del Govern i el Parlament fins que es corregeix. És el mateix que passa avui entre el Govern i el Parlament.

## `municipis.json`

- **Font:** [El municipi en xifres](https://www.idescat.cat/emex/) de l'Idescat, per la seva [API EMEX](https://www.idescat.cat/dev/api/emex/). Les [condicions d'ús](https://www.idescat.cat/dev/api/#cdu) en permeten la reutilització si se'n cita la font i no s'alteren les dades.
- **Contingut:** de cada municipi, els mateixos indicadors: la població, la població de nacionalitat estrangera, la nascuda a l'estranger, la que sap parlar català, l'atur registrat, la base imposable de l'IRPF per declarant, l'índex socioeconòmic territorial i la participació a les últimes eleccions municipals i al Parlament. De les taules de població també hi ha el total, perquè se'n pugui calcular el percentatge.
- **Per què aquests:** són els que l'Idescat dona per a tots els municipis sobre els temes que es van demanar per a la fitxa de cada municipi: la població i el seu origen, la llengua, la feina, la renda i la participació electoral. Tots els municipis tenen els mateixos, i a la llista d'`INDICADORS` de [src/municipis.ts](../src/municipis.ts) no hi ha cap tria per municipi. La renda familiar disponible no hi és perquè l'Idescat només la dona per als municipis de més de 1.000 habitants.
- **Forma:** cada indicador ha de dir l'any (quatre xifres, o amb «(p)» al darrere si l'Idescat diu que la dada és provisional, com «2024 (p)»), la taula i la data d'actualització. Si l'API els torna en un altre ordre, es desen en el d'`INDICADORS`.
- **Data:** cada indicador té el seu any (`any`) i la data en què l'Idescat el va actualitzar (`actualitzat`), els mateixos per a tots els municipis. El coneixement del català per municipi és del cens del 2011, l'últim que el dona per a tots.
- **Valors:** tal com els dona l'Idescat. Un valor que l'Idescat no dona per a un municipi és `null`, no un zero.
- **Comprovacions:**
  - Totes les crides han de tornar els mateixos municipis, en el mateix ordre, només municipis i cap de repetit.
  - Han de ser els mateixos municipis que els de Municat (`ajuntaments.json`), pel mateix codi.
  - Cada indicador ha de tenir un valor per municipi, i cada valor ha de ser un nombre o «_» (no hi és).
- **Si falla:** com la resta de fitxers, atura l'actualització de tots fins que es corregeix.

## `eleccions-municipals.json`

- **Font:** [Eleccions municipals. Vots](https://analisi.transparenciacatalunya.cat/d/vq27-2ky2) (`vq27-2ky2`), de la Secretaria de Governs Locals, a Dades obertes de Catalunya, amb la [llicència de dades obertes de la Generalitat](https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/).
- **Elecció:** les últimes municipals que té el conjunt (`any`). Es busca l'any més alt cada vegada, i quan la font hi afegeixi unes eleccions noves el fitxer passarà a ser el d'aquestes. El conjunt no diu si unes eleccions són generals o parcials: si algun dia hi surten unes de parcials amb un any nou, faltaran municipis, la comprovació fallarà i caldrà decidir com tractar-les.
- **Contingut:** de cada municipi, totes les candidatures que la font dona, amb les sigles, els vots, el percentatge (el que calcula la font) i els regidors. Totes tenen els mateixos camps.
- **Ordre:** de més a menys vots, i, amb els mateixos vots, per les sigles en ordre alfabètic. És la mateixa regla per a totes les candidatures.
- **Valors:** tal com els dona la font. L'única conversió és el percentatge: la font el dona en centèsimes («2268») i es publica com a percentatge (22,68). Les sigles són les de la font, que pot escriure el mateix partit de maneres diferents en municipis o anys diferents: no s'unifiquen.
- **Què no hi és:** les eleccions al Parlament per municipi. Aquest conjunt només té les municipals.
- **Comprovacions:**
  - Han de ser els mateixos municipis que els de Municat (`ajuntaments.json`), pel mateix codi.
  - Cada fila ha de tenir el codi, el municipi, les sigles, els vots, el percentatge i els regidors, i els tres últims han de ser nombres.
  - Un codi només pot correspondre a un municipi, i una candidatura només pot sortir una vegada a cada municipi.
  - Les files de l'elecció han de cabre en una sola consulta.
- **Si falla:** com la resta de fitxers, atura l'actualització de tots fins que es corregeix.

## `mapa-municipis.json`

- **Font:** els límits dels municipis de les [divisions administratives](https://geoserveis.icgc.cat/servei/catalunya/divisions-administratives/wfs?service=WFS&request=GetCapabilities) de l'Institut Cartogràfic i Geològic de Catalunya (ICGC), pel seu servei WFS. Les [condicions d'ús](http://www.icgc.cat/condicions) de l'ICGC en permeten la reutilització si se'n cita la font i la data de l'última actualització.
- **Per què l'ICGC:** és l'organisme que fa la cartografia oficial de Catalunya. Cap de les altres fonts de la taula de NEUTRALITAT.md no publica els límits dels municipis.
- **Capa:** `divisions_administratives_municipis_1000000`, la més simplificada, a escala 1:1.000.000. N'hi ha prou per a un mapa de tot Catalunya, però no serveix per saber per on passa exactament un límit.
- **Contingut:** de cada municipi, el codi, el nom i la geometria, en graus (EPSG:4326), tal com els dona el servei. El fitxer no simplifica ni arrodoneix res: si la web en dibuixa menys punts, és cosa de la web.
- **Data:** el servei no diu quan es van actualitzar els límits. `data_consulta` és el dia en què es van llegir.
- **Comprovacions:**
  - Han de ser els mateixos municipis que els de Municat (`ajuntaments.json`), pel mateix codi, i cap no pot sortir dues vegades.
  - Cada municipi ha de tenir codi de sis xifres, nom i un polígon o multipolígon amb coordenades dins de Catalunya. Si arriben en metres en lloc de graus, la consulta ha canviat i s'atura.
- **Si falla:** com la resta de fitxers, atura l'actualització de tots fins que es corregeix.

## `agenda.json`

Els actes públics del Govern i del Parlament del mes passat, l'actual i el següent. La web els mostra a [/agenda](https://finestraoberta.cat/agenda).

### `govern`

- **Font:** el conjunt [Actes del Govern](https://analisi.transparenciacatalunya.cat/d/wf87-e34n) (`wf87-e34n`), que publica la Direcció General de Comunicació a Dades obertes de Catalunya. Es demana amb una sola consulta, ordenada per data, hora i identificador perquè es pugui reproduir.
- **Data:** `data_dades` és la data de l'última actualització del conjunt.
- **Qui hi surt:** només els actes que el conjunt atribueix a `President`, `Consellers` o `Portaveu del Govern`, és a dir, al Consell Executiu. Les altres autoritats del conjunt (secretaris, directors i delegats) no hi surten. El criteri és a `autoritats`.
- **Només actes fets:** el conjunt publica els actes quan ja han passat. Els que encara no s'han fet no hi són, i la web ho diu.
- **Text:** el títol, la descripció, l'adreça, el municipi, l'autoritat i el departament són els de la font, amb les entitats HTML (`&nbsp;`, `&quot;`…) convertides en caràcters i els espais i salts de línia seguits convertits en un sol espai.
- **Comprovacions:**
  - El conjunt repeteix algunes files idèntiques: se'n deixa una. Si dues files amb el mateix `id` no són idèntiques, l'script s'atura.
  - Cada acte ha de tenir la data i l'hora en el format del conjunt.
  - Els actes han de cabre en una pàgina de 5.000 files.

### `parlament`

- **Font:** l'[agenda parlamentària](https://www.parlament.cat/web/actualitat/agenda/index.html) del web del Parlament, mes a mes. El Parlament no la publica en cap format de dades.
- **Data:** com a `parlament.json`, `data_consulta` és el dia en què es va llegir.
- **Categoria:** el web no la diu a cada acte, però la deixa filtrar. Per a cada mes es llegeix l'agenda sencera i després la de cada categoria del desplegable (sessions dels òrgans, actes institucionals, conferències de premsa i reunions de treball), i cada acte ha de sortir en una sola categoria.
- **Contingut:** la data, l'hora, el títol, els paràgrafs de l'acte tal com surten al web (`detalls`: el tipus de sessió, la sala, si s'emet en directe), els enllaços de l'acte (l'ordre del dia, el vídeo, el programa), el dia en què es va publicar i, si s'ha desconvocat, quan. La icona de càmera del costat de l'hora no es desa: enllaça la portada del Canal Parlament, no el vídeo de l'acte.
- **Ordre:** el del web. Els actes sense hora van just després de l'acte que els precedeix al web.
- **Sense hora:** alguns actes no en tenen perquè comencen en acabar-ne un altre, i el web ho diu a `detalls`.
- **Comprovacions:**
  - Cada pàgina ha de ser del mes demanat, i el dia de la setmana de cada data ha de coincidir.
  - Totes les files d'actes s'han de poder llegir: si en sobra alguna, l'script s'atura.
  - L'hora ha de ser `HH:MMh` o estar buida.
  - Tots els enllaços i paràgrafs de cada acte s'han de poder llegir.
  - Cada acte de l'agenda sencera ha de sortir en una categoria, i només en una.
- **Si una font falla:** l'agenda es genera amb la resta de dades, i si no es pot llegir, tampoc s'actualitzen el Govern ni el Parlament aquell dia. Així totes les dades d'un dia surten d'una mateixa execució i es poden comprovar juntes.
- **Cada dia:** a diferència de la composició, `agenda.json` es desa encara que l'únic canvi sigui `data_consulta`, perquè la web en treu quins actes ja han passat.
- **Reutilització:** la mateixa que la de les fotos: l'[avís legal](https://www.parlament.cat/pcat/serveis-parlament/avis-legal) del Parlament en permet la reutilització si se'n cita la font, no se n'altera el sentit i no es presenta com una versió oficial ni avalada pel Parlament.

## `activitat.json`

Què ha decidit el Parlament: el resultat de cada punt de les sessions del Ple de la legislatura en curs, i les lleis i els decrets llei publicats al DOGC des que va començar.

- **Fonts:**
  - Les [sessions tingudes del Ple](https://www.parlament.cat/web/activitat-parlamentaria/sessions-organs/sessions-tingudes/index.html?p_legislatura=15&p_codi=46) i la pàgina d'acords de cada sessió, al web del Parlament de Catalunya. Com la composició, es llegeixen de les pàgines web, amb les condicions de l'[avís legal](https://www.parlament.cat/pcat/serveis-parlament/avis-legal) del Parlament.
  - La [normativa del DOGC](https://analisi.transparenciacatalunya.cat/d/n6hn-rmy7) (`n6hn-rmy7`), de l'Entitat Autònoma del Diari Oficial i de Publicacions (EADOP), a Dades obertes de Catalunya, amb la [llicència de dades obertes de la Generalitat](https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/).
- **Legislatura:** és la primera de la llista de legislatures del Parlament. Quan en comenci una de nova, el fitxer passarà a ser el de la nova.
- **Sessions:** totes les del Ple, de la més nova a la més antiga, amb el número, el caràcter (ordinària, específica…), el dia, l'hora i l'enllaç a la pàgina d'acords. La llista del Parlament repeteix algunes sessions en dues files idèntiques: es desen una vegada.
- **Punts:** de cada sessió, tots els punts de l'ordre del dia, en l'ordre de la font, amb el títol, el número d'expedient i l'enllaç a la tramitació. `acord` és el text de l'acord tal com l'escriu el Parlament («S'aprova la Moció.», «Es rebutja.», «Se substancia.»…), i és buit si el Parlament no n'hi posa cap.
- **Resultat:** `resultat` és `aprovat`, `convalidat`, `derogat` (un decret llei que el Ple no convalida) o `rebutjat` quan l'acord comença per un dels textos de `RESULTATS` a [src/activitat.ts](../src/activitat.ts), i `null` en tots els altres casos. La regla és la mateixa per a totes les iniciatives, les presenti qui les presenti. Un acord sobre una esmena a la totalitat («S'aprova l'esmena a la totalitat…») parla de l'esmena i no de la iniciativa, i queda sense resultat. El text original és sempre a `acord`. La taula es va comprovar el 22 de novembre de 2026 amb el text sencer de tots els acords de les 56 sessions del Ple de la legislatura: cap altra fórmula diu que s'aprova o es rebutja la iniciativa del punt. Els que queden sense resultat diuen, per exemple, que el punt «Se substancia», que s'ajorna o que es retira, o només nomenen la comissió que l'ha de tramitar. També en queden sense els que decideixen sobre la tramitació i no sobre la iniciativa («El Ple acorda de rebutjar la sol·licitud que el decret llei es tramiti com a projecte de llei»), perquè la convalidació del decret llei és un altre punt de la mateixa sessió, i la investidura, que no és cap iniciativa.
- **Normes:** les que el DOGC classifica amb el rang `Llei` o `Decret llei` i que es van publicar des del dia de la sessió constitutiva, de la més nova a la més antiga. De cadascuna: el títol, el rang, la data, la data i el número del DOGC, la vigència i l'enllaç ELI al Portal Jurídic. `data_dades` és l'última actualització del conjunt.
- **Vots i assistència:** no n'hi ha. El Parlament no publica qui ha votat què ni l'assistència de cada persona diputada, i el recompte de cada votació només surt al Diari de Sessions, en PDF. No s'endevinen a partir de res més, com la posició de cada grup.
- **Resums:** si algun dia s'hi afegeixen resums fets amb IA, aniran en un fitxer a part, lligats a cada punt pel número d'expedient o a cada norma per l'enllaç ELI, perquè `activitat.json` continuï dient només el que diu la font.
- **Comprovacions:**
  - La legislatura en curs ha de ser el primer element de la llista de legislatures.
  - Cada fila de la llista de sessions i cada punt d'una pàgina d'acords s'ha de poder llegir. Si la forma de la pàgina canvia, l'script s'atura.
  - Dues files de la llista amb el mateix número de sessió han de ser idèntiques.
  - Els punts d'una sessió, sumant totes les pàgines, han d'anar d'1 fins a l'últim sense salts.
  - Cada pàgina d'acords ha de tenir almenys un punt, i se n'han de llegir tots els que numera.
  - Cada norma ha de tenir el títol, el rang, les dates, el número del DOGC, la vigència i l'enllaç.
  - Les normes han de cabre en una sola consulta.
- **Si falla:** com que l'activitat es genera amb el Govern, el Parlament i els ajuntaments, una comprovació que falla atura l'actualització de tots els fitxers fins que es corregeix.

## `ajuts.json`

- **Font:** les [convocatòries del RAISC](https://analisi.transparenciacatalunya.cat/d/khxn-nv6a) (`khxn-nv6a`), el Registre de subvencions i ajuts de Catalunya, del Departament d'Economia i Finances, a Dades obertes de Catalunya, amb la [llicència de dades obertes de la Generalitat](https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/). Recull les convocatòries de totes les administracions de Catalunya, no només de la Generalitat.
- **Data:** `data_dades` és la data de l'última actualització del conjunt, que s'actualitza cada dia.
- **Contingut:** les convocatòries que el dia de la consulta, a l'hora de Catalunya, encara no han acabat el termini de presentació de sol·licituds (`fi` és avui o més endavant). Hi són també les que encara no l'han obert (`inici` és més endavant). Van ordenades pel final del termini i, després, pel codi RAISC.
- **Les que queden fora:** les que la font dona sense final de termini, o amb un final que no és una data (el conjunt en té, per exemple, amb «-»), perquè no es pot dir si són obertes. `finals_no_llegibles` diu quins valors tenen i quantes convocatòries n'hi ha de cadascun, perquè es vegi què s'ha deixat fora.
- **Dates:** el RAISC les escriu com a text, «19/10/2026». `inici` i `fi` són les mateixes dates en la forma `2026-10-19`; les originals són a `inici_font` i `fi_font`. Si l'inici no és una data, `inici` és `null` i el valor de la font és a `inici_font`.
- **Camps:** el títol en català, l'organisme i l'administració que convoca, el tipus de convocatòria i d'ajut, la finalitat, a qui va adreçada, l'import total, la seu electrònica on es demana i l'enllaç a les bases. Tal com els escriu la font. Totes les convocatòries tenen els mateixos camps, i el que la font no dona és `null`.
- **Com es llegeix:** el final del termini és text i SoQL no el pot comparar amb una data. Per això primer es demanen tots els finals de termini diferents del conjunt (són pocs) i després les convocatòries que en tenen un de vigent, de cent en cent dates perquè l'adreça de la consulta no sigui massa llarga.
- **Comprovacions:**
  - Hi ha d'haver almenys un final de termini d'avui o més endavant. El RAISC sempre té convocatòries obertes: si no en surt cap, la font ha canviat la forma de les dates, i una llista buida diria que no se'n pot demanar cap.
  - Cada convocatòria ha de tenir codi RAISC, i un codi només pot sortir una vegada. L'import ha de ser un nombre.
- **Cada dia canvia:** com que les convocatòries tanquen i n'obren de noves, `ajuts.json` canvia gairebé cada dia, i la branca `dades` té una actualització signada gairebé cada dia.
- **Si falla:** com els ajuntaments, atura també l'actualització del Govern i el Parlament fins que es corregeix.

## `pressupost.json`

- **Fonts:** l'execució mensual del pressupost de la Generalitat de Catalunya, del Departament d'Economia i Finances, a Dades obertes de Catalunya, amb la [llicència de dades obertes de la Generalitat](https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/):
  - [Despeses](https://analisi.transparenciacatalunya.cat/d/ajns-4mi7) (`ajns-4mi7`).
  - [Ingressos](https://analisi.transparenciacatalunya.cat/d/42am-vra2) (`42am-vra2`).
- **Període:** l'últim mes publicat de cada conjunt (`exercici` i `mes`, tal com els escriu la font, per exemple «10 Octubre»). Segons la font, els imports són els acumulats des de l'1 de gener fins a l'últim dia d'aquell mes. Els dos conjunts poden anar per mesos diferents. Només hi surten les entitats que tenen files en aquell mes: a l'octubre del 2026 n'eren 82, i d'un mes a l'altre en varien una o dues.
- **Despeses:** per entitat i secció, el crèdit inicial, el pressupost definitiu, les obligacions reconegudes (el que ja s'ha de pagar) i les obligacions pagades.
- **Ingressos:** per entitat i capítol, la previsió inicial, la previsió final, els drets reconeguts nets i la recaptació neta.
- **Sumes:** les fa l'API de la font, amb `sum()` sobre totes les files de cada grup. El codi no suma res.
- **Sense total:** el fitxer no té cap total de totes les entitats. Les transferències d'una entitat a una altra hi comptarien dues vegades, a la que dona i a la que rep.
- **Ordre i noms:** el dels codis de la font. Primer el codi de l'entitat i després l'ordre de protocol de la secció o el número del capítol, tots dos com a nombres. Les seccions sense ordre de protocol van al final de la seva entitat, i quan l'ordre coincideix o falta, s'ordenen pel codi de la secció. Els noms són tal com els escriu la font, també quan són abreujats («Territori, Habitatge i Transició Ecol.»).
- **Comprovacions:**
  - El període ha de tenir un any de quatre xifres i un mes de la forma «10 Octubre».
  - Cada import, cada ordre de protocol i cada codi de capítol ha de ser un nombre, i cada fila ha de tenir el codi i el nom de l'entitat, i el codi i el nom de la secció o el codi del capítol. L'ordre de protocol i el nom del capítol poden faltar, i llavors són `null`: a l'octubre del 2026, 49 entitats no donaven l'ordre de cap secció.
  - Una entitat i una secció, o una entitat i un capítol, només poden sortir una vegada.
  - Cada consulta ha de tornar alguna fila i cabre en una pàgina.
- **Si falla:** com la resta de fitxers, atura l'actualització de tots fins que es corregeix.

## Pendent

- Qui ha votat què i l'assistència a les votacions. El Parlament diu al seu [portal de transparència](https://www.parlament.cat/web/transparencia/sumari/index.html?p_id=173806) que els resultats individuals es publicaran a la propera legislatura. Mentrestant, només es poden demanar amb el dret d'accés a la informació pública.

- Les declaracions de béns patrimonials dels membres del Govern no són a Dades obertes de Catalunya. Abans d'afegir-les, cal trobar-ne una font oficial que es pugui llegir sense haver de fer servir les pàgines de cada departament.

- Els escons que va obtenir cada candidatura a les eleccions del 12 de maig de 2024 s'han de treure dels resultats oficials, que són una altra font.
