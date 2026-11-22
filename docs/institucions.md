# El Govern i el Parlament

Les dades que canvien poc: qui forma el Govern, què en publica el Portal de la Transparència i com es reparteixen els 135 escons del Parlament. Són en JSON a la branca [`dades`](https://github.com/Gonvar/finestra-oberta/tree/dades), perquè la web les pugui mostrar sense consultar les fonts. El codi que les genera és a `main`.

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

Cal el codi amb què es van generar, perquè un canvi posterior pot demanar les fonts d'una altra manera. També cal la versió de Node que diu `node` a `procedencia.json`: l'ordre alfabètic dels grups i dels departaments depèn de la versió.

**3. La font encara diu el mateix.** Executa `npm run dades -- /tmp/ara` pel teu compte i compara `/tmp/ara/govern.json` i `/tmp/ara/parlament.json` amb els publicats. Si la composició ha canviat des de l'última actualització, la diferència ha de ser la d'aquest canvi. Aquesta comprovació també detecta unes dades antigues tornades a publicar, que passarien les dues primeres.

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
  - `agenda`: quantes files amb grups d'interès té l'agenda des del nomenament (`contactes`), i les cinc últimes. La relació posa una fila per grup i no diu quines són d'una mateixa reunió, i per això es compten les files tal com les dona: una reunió amb tres grups compta tres vegades. No compten les files sense grup («-»), que la relació fa servir per dir que en un trimestre no n'hi ha hagut cap. Si un membre nomenat fa més de dos trimestres no té cap fila, ni tan sols «-», la tasca falla: vol dir que el nom o el càrrec ja no es troben, i un zero seria fals.
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

## `agenda.json`

Els actes públics del Govern i del Parlament del mes passat, l'actual i el següent. La web els mostra a [/agenda](https://finestraoberta.cat/agenda).

### `govern`

- **Font:** el conjunt [Actes del Govern](https://analisi.transparenciacatalunya.cat/d/wf87-e34n) (`wf87-e34n`), que publica la Direcció General de Comunicació a Dades obertes de Catalunya. Es demana amb una sola consulta, ordenada per data, hora i identificador perquè es pugui reproduir.
- **Data:** `data_dades` és la data de l'última actualització del conjunt.
- **Qui hi surt:** només els actes que el conjunt atribueix a `President`, `Consellers` o `Portaveu del Govern`, és a dir, al Consell Executiu. Les altres autoritats del conjunt (secretaris, directors i delegats) no hi surten. El criteri és a `autoritats`.
- **Només actes fets:** el conjunt publica els actes quan ja han passat. Els que encara no s'han fet no hi són, i la web ho diu.
- **Text:** el títol, la descripció, l'adreça i el municipi són els de la font, amb les entitats HTML (`&nbsp;`, `&quot;`…) convertides en caràcters.
- **Comprovacions:**
  - El conjunt repeteix algunes files idèntiques: se'n deixa una. Si dues files amb el mateix `id` no són idèntiques, l'script s'atura.
  - Cada acte ha de tenir la data i l'hora en el format del conjunt.
  - Els actes han de cabre en una pàgina de 5.000 files.

### `parlament`

- **Font:** l'[agenda parlamentària](https://www.parlament.cat/web/actualitat/agenda/index.html) del web del Parlament, mes a mes. El Parlament no la publica en cap format de dades.
- **Data:** com a `parlament.json`, `data_consulta` és el dia en què es va llegir.
- **Categoria:** el web no la diu a cada acte, però la deixa filtrar. Per a cada mes es llegeix l'agenda sencera i després la de cada categoria del desplegable (sessions dels òrgans, actes institucionals, conferències de premsa i reunions de treball), i cada acte ha de sortir en una sola categoria.
- **Contingut:** la data, l'hora, el títol, els paràgrafs de l'acte tal com surten al web (`detalls`: el tipus de sessió, la sala, si s'emet en directe), els enllaços (l'ordre del dia, el vídeo, el programa), el dia en què es va publicar i, si s'ha desconvocat, quan.
- **Sense hora:** alguns actes no en tenen perquè comencen en acabar-ne un altre, i el web ho diu a `detalls`.
- **Comprovacions:**
  - Cada pàgina ha de ser del mes demanat, i el dia de la setmana de cada data ha de coincidir.
  - Totes les files d'actes s'han de poder llegir: si en sobra alguna, l'script s'atura.
  - L'hora ha de ser `HH:MMh` o estar buida.
  - Cada acte de l'agenda sencera ha de sortir en una categoria, i només en una.
- **Reutilització:** la mateixa que la de les fotos: l'[avís legal](https://www.parlament.cat/pcat/serveis-parlament/avis-legal) del Parlament en permet la reutilització si se'n cita la font, no se n'altera el sentit i no es presenta com una versió oficial ni avalada pel Parlament.

## Pendent

- Les declaracions de béns patrimonials dels membres del Govern no són a Dades obertes de Catalunya. Abans d'afegir-les, cal trobar-ne una font oficial que es pugui llegir sense haver de fer servir les pàgines de cada departament.

- Els escons que va obtenir cada candidatura a les eleccions del 12 de maig de 2024 s'han de treure dels resultats oficials, que són una altra font.
