# El Govern i el Parlament

Les dades que canvien poc: qui forma el Govern i com es reparteixen els 135 escons del Parlament. Són en JSON a la branca [`dades`](https://github.com/Gonvar/finestra-oberta/tree/dades), perquè la web les pugui mostrar sense consultar les fonts. El codi que les genera és a `main`.

```sh
npm run dades
```

L'script ho llegeix i ho comprova tot abans d'escriure res. Si una comprovació falla, surt amb un error i deixa els fitxers com estaven. Per això es pot executar sense ningú al davant. Escriu a `dades/`, que no forma part de `main`.

## Actualització automàtica

La tasca [`dades.yml`](../.github/workflows/dades.yml) s'executa cada dia a les 5.00 UTC. També es pot llançar a mà des de la pestanya Actions de GitHub.

- Executa `npm run dades` sobre la branca `dades` i comprova que el resultat es pot reproduir a partir de les còpies de les fonts.
- Si alguna cosa ha canviat, signa els fitxers amb una attestation i en fa un commit a `dades`. El commit enllaça el commit de `main` amb què s'ha generat i l'execució de la tasca.
- Si l'únic canvi és `data_consulta`, no fa cap commit: la composició és la mateixa.
- Si una font falla o una comprovació no quadra, la tasca falla, GitHub ho notifica i `dades` es queda com estava. Aleshores cal mirar-ne el registre i corregir la causa.

Les dades no passen per pull request perquè no les escriu cap persona. El codi que les genera sí: tot canvi a `main` el revisa algú que manté el projecte.

## Com comprovar que les dades són de la font

Al costat de cada JSON hi ha:

- `captures/`: la resposta de cada font oficial tal com va arribar, sense cap canvi. Cada fitxer es diu com la seva empremta SHA-256.
- `procedencia.json`: de cada resposta, l'URL, l'hora de la consulta, el codi HTTP, el tipus de contingut i l'empremta, en l'ordre en què es van demanar.

Hi ha tres comprovacions, i les pot fer qualsevol persona.

**1. Les dades surten de les còpies, sense retocs.** Torna a generar els JSON a partir de `captures/` amb el mateix codi i comprova que surten idèntics, byte a byte, i que cada còpia té l'empremta que diu `procedencia.json`:

```sh
git clone https://github.com/Gonvar/finestra-oberta.git
cd finestra-oberta
git clone --branch dades https://github.com/Gonvar/finestra-oberta.git dades
npm run verifica-dades
```

Cal el codi de `main` amb què es van generar, que enllaça el missatge del commit de `dades`.

**2. Les ha generat la tasca automàtica, i no una persona.** Cada actualització porta una [attestation de GitHub](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations) que diu quin workflow, quin commit de `main` i quina execució han produït aquests fitxers. Es desa al registre públic de [Sigstore](https://www.sigstore.dev/), que no controla aquest projecte i on no es pot esborrar res:

```sh
gh attestation verify dades/govern.json --repo Gonvar/finestra-oberta \
  --signer-workflow Gonvar/finestra-oberta/.github/workflows/dades.yml --source-ref refs/heads/main
```

Fes el mateix amb `parlament.json` i `procedencia.json`. Si algú canviés un fitxer a mà, o reescrivís la història de la branca, no hi hauria cap attestation amb la seva empremta.

**3. La font encara diu el mateix.** Executa `npm run dades` pel teu compte i compara-ho amb el que hi ha publicat. Si la composició ha canviat des de l'última actualització, la diferència ha de ser la d'aquest canvi.

### Què no demostra

- Que la font oficial digui la veritat. Les dades són les que va publicar la font aquell dia. Si la font s'equivoca, l'error hi és.
- Que la resposta vingués del servidor oficial. HTTPS no signa les respostes, i el que es pot provar és que la tasca automàtica, executant un codi públic, va rebre aquests bytes en connectar-se a l'URL oficial.
- Qui administra el repositori pot canviar el workflow o la protecció de la branca. Tots dos canvis queden a la vista: el workflow és a la història de `main`, i un fitxer que no surt d'una execució del workflow no té attestation.

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
- **Contingut:** la legislatura, els grups amb els escons i els subgrups, i cada persona amb el càrrec, el grup, la circumscripció, la llista electoral, el partit i l'enllaç a la seva fitxa.
- **Comprovacions:**
  - Hi ha d'haver 135 persones i 135 escons diferents.
  - Totes les còpies d'un escó al mapa han de coincidir.
  - Cada fitxa ha de donar la circumscripció.
  - Si una fitxa dona el grup, ha de ser el mateix que diu el mapa.
  - Les fitxes han de donar una sola legislatura en curs.
- **Grups:** són els d'avui, que poden no coincidir amb els resultats de les eleccions.
- **Subgrups:** el mapa mostra els membres d'un subgrup dues vegades, una amb el grup i una altra amb el subgrup. Es comptabilitzen al grup i, a més, al subgrup.

## Pendent

- Els escons que va obtenir cada candidatura a les eleccions del 12 de maig de 2024 s'han de treure dels resultats oficials, que són una altra font.
- Les fotos de les persones diputades no s'hi inclouen fins que se'n comprovi la llicència.
