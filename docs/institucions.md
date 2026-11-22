# El Govern, el Parlament i els ajuntaments

Les dades que canvien poc: qui forma el Govern, com es reparteixen els 135 escons del Parlament i qui forma el ple de cada ajuntament. Són en JSON a la branca [`dades`](https://github.com/Gonvar/finestra-oberta/tree/dades), perquè la web les pugui mostrar sense consultar les fonts. El codi que les genera és a `main`.

```sh
npm run dades
```

L'script ho llegeix i ho comprova tot abans d'escriure res. Si una comprovació falla, surt amb un error i deixa els fitxers com estaven. Per això es pot executar sense ningú al davant. Escriu a `dades/`, que no forma part de `main`.

## Actualització automàtica

La tasca [`dades.yml`](../.github/workflows/dades.yml) s'executa cada dia a les 5.00 UTC. També es pot llançar a mà des de la pestanya Actions de GitHub.

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

**3. La font encara diu el mateix.** Executa `npm run dades -- /tmp/ara` pel teu compte i compara `/tmp/ara/govern.json`, `/tmp/ara/parlament.json` i `/tmp/ara/ajuntaments.json` amb els publicats. Si la composició ha canviat des de l'última actualització, la diferència ha de ser la d'aquest canvi. Aquesta comprovació també detecta unes dades antigues tornades a publicar, que passarien les dues primeres.

### Què no demostra

- Que la font oficial digui la veritat. Les dades són les que va publicar la font aquell dia. Si la font s'equivoca, l'error hi és.
- Que la resposta vingués del servidor oficial. HTTPS no signa les respostes, i el que es pot provar és que la tasca automàtica, executant un codi públic, va rebre aquests bytes en connectar-se a l'URL oficial.
- Qui administra el repositori pot canviar el ruleset, l'entorn o el workflow. Un canvi al workflow queda a la història de `main`, i un fitxer que no surt d'una execució del workflow de `main` no té atestació. Un canvi al ruleset o a l'entorn no és públic: si algú el fes servir per tornar a publicar dades antigues, ho detectaria la comprovació 3.

## `govern.json`

- **Font:** la [relació d'alts càrrecs dels departaments](https://analisi.transparenciacatalunya.cat/d/x9au-abcn) (`x9au-abcn`), que publica la Secretaria d'Administració i Funció Pública a Dades obertes de Catalunya.
- **Data:** `data_dades` és la data de l'última actualització del conjunt, no la del dia en què s'executa l'script.
- **Contingut:** el president i un conseller o consellera per departament, amb el nom, el càrrec i el departament.
- **Noms:** la relació els escriu en majúscules i, en alguns casos, sense accents: «PANE MENA, OLGA». El nom ben escrit, «Olga Pané i Mena», surt de les [intervencions del Govern al Parlament](https://analisi.transparenciacatalunya.cat/d/7chp-hkce) (`7chp-hkce`), que té la seva pròpia data (`data_noms`). Totes les paraules del nom oficial han de ser al nom escrit, i ha de coincidir amb un sol nom.
- **Càrrecs:** «Consellera de Salut» es forma amb el sexe i el departament que dona la relació. Tal com els escriu la relació, el nom i el càrrec són a `nom_oficial` i `carrec_oficial`.
- **Comprovacions:**
  - Hi ha d'haver un president, i cada departament ha de tenir un conseller, i només un.
  - Cada persona ha de tenir un nom, i només un, a les intervencions. Una persona que encara no ha intervingut al Parlament atura l'script fins que s'hi afegeixi.

## `parlament.json`

- **Font:** la [distribució d'escons](https://www.parlament.cat/web/composicio/distribucio-escons/index.html) del Parlament de Catalunya i la fitxa de cada persona diputada. El Parlament no té cap API amb la composició: les dades es llegeixen de les pàgines web.
- **Data:** el Parlament no publica quan va canviar la composició per última vegada. Per això `data_consulta` és el dia en què es van llegir les pàgines i hi va sortir la composició que hi ha al fitxer. Com que la tasca automàtica només desa els canvis, pot ser anterior a l'última comprovació.
- **Contingut:** la legislatura, els grups amb els escons i els subgrups, i cada persona amb el càrrec, el grup, la circumscripció, la llista electoral, el partit, l'enllaç a la seva fitxa i l'enllaç a la seva foto.
- **Comprovacions:**
  - Hi ha d'haver 135 persones i 135 escons diferents.
  - Totes les còpies d'un escó al mapa han de coincidir.
  - Cada fitxa ha de donar la circumscripció.
  - Almenys una fitxa ha de donar la foto, i dues fitxes no poden donar la mateixa. Una persona que encara no té foto surt sense `foto`, i la composició s'actualitza igualment.
  - Si una fitxa dona el grup, ha de ser el mateix que diu el mapa.
  - Les fitxes han de donar una sola legislatura en curs.
- **Grups:** són els d'avui, que poden no coincidir amb els resultats de les eleccions.
- **Fotos:** `foto` és l'enllaç a la foto oficial al web del Parlament, a la mida mitjana (fins a 600 px pel costat llarg). No se'n desa cap còpia. L'[avís legal](https://www.parlament.cat/pcat/serveis-parlament/avis-legal) del Parlament en permet la reutilització si se'n cita la font, no se n'altera el sentit i no es presenten com una versió oficial ni avalada pel Parlament. Cal mostrar-les amb «Foto: Parlament de Catalunya». Les condicions també són al camp `fotos` del fitxer.
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

## Pendent

- Els escons que va obtenir cada candidatura a les eleccions del 12 de maig de 2024 s'han de treure dels resultats oficials, que són una altra font.
- Falten les fotos dels membres del Govern que no són diputats. [govern.cat](https://govern.cat/gov/consell-executiu) en publica sota CC0, però de mides i enquadraments diferents.
