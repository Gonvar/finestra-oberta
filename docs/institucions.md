# El Govern i el Parlament

Les dades que canvien poc: qui forma el Govern i com es reparteixen els 135 escons del Parlament. Són a [`dades/`](../dades/) en JSON, perquè la web les pugui mostrar sense consultar les fonts.

```sh
npm run dades
```

L'script ho llegeix i ho comprova tot abans d'escriure res. Si una comprovació falla, surt amb un error i deixa els fitxers com estaven. Per això es pot executar sense ningú al davant.

## Actualització automàtica

La tasca [`dades.yml`](../.github/workflows/dades.yml) s'executa cada dia a les 5.00 UTC. També es pot llançar a mà des de la pestanya Actions de GitHub.

- Executa `npm run dades`, passa Prettier per `dades/` i, si alguna cosa ha canviat, en fa un commit a `main`.
- Si l'únic canvi és `data_consulta`, no fa cap commit: la composició és la mateixa.
- Si una font falla o una comprovació no quadra, la tasca falla, GitHub ho notifica i `dades/` es queda com estava. Aleshores cal mirar-ne el registre i corregir la causa.

## `dades/govern.json`

- **Font:** la [relació d'alts càrrecs dels departaments](https://analisi.transparenciacatalunya.cat/d/x9au-abcn) (`x9au-abcn`), que publica la Secretaria d'Administració i Funció Pública a Dades obertes de Catalunya.
- **Data:** `data_dades` és la data de l'última actualització del conjunt, no la del dia en què s'executa l'script.
- **Contingut:** el president i un conseller o consellera per departament, amb el nom, el càrrec i el departament.
- **Noms:** la relació els escriu en majúscules i, en alguns casos, sense accents: «PANE MENA, OLGA». El nom ben escrit, «Olga Pané i Mena», surt de les [intervencions del Govern al Parlament](https://analisi.transparenciacatalunya.cat/d/7chp-hkce) (`7chp-hkce`), que té la seva pròpia data (`data_noms`). Totes les paraules del nom oficial han de ser al nom escrit, i ha de coincidir amb un sol nom.
- **Càrrecs:** «Consellera de Salut» es forma amb el sexe i el departament que dona la relació. Tal com els escriu la relació, el nom i el càrrec són a `nom_oficial` i `carrec_oficial`.
- **Comprovacions:**
  - Hi ha d'haver un president, i cada departament ha de tenir un conseller, i només un.
  - Cada persona ha de tenir un nom, i només un, a les intervencions. Una persona que encara no ha intervingut al Parlament atura l'script fins que s'hi afegeixi.

## `dades/parlament.json`

- **Font:** la [distribució d'escons](https://www.parlament.cat/web/composicio/distribucio-escons/index.html) del Parlament de Catalunya i la fitxa de cada persona diputada. El Parlament no té cap API amb la composició: les dades es llegeixen de les pàgines web.
- **Data:** el Parlament no publica quan va canviar la composició per última vegada. Per això `data_consulta` és el dia en què es van llegir les pàgines i hi va sortir la composició que hi ha al fitxer. Com que la tasca automàtica només desa els canvis, pot ser anterior a l'última comprovació.
- **Contingut:** la legislatura, els grups amb els escons i els subgrups, i cada persona amb el càrrec, el grup, la circumscripció, la llista electoral, el partit, l'enllaç a la seva fitxa i l'enllaç a la seva foto.
- **Comprovacions:**
  - Hi ha d'haver 135 persones i 135 escons diferents.
  - Totes les còpies d'un escó al mapa han de coincidir.
  - Cada fitxa ha de donar la circumscripció i la foto. Una persona sense foto atura l'script.
  - Si una fitxa dona el grup, ha de ser el mateix que diu el mapa.
  - Les fitxes han de donar una sola legislatura en curs.
- **Grups:** són els d'avui, que poden no coincidir amb els resultats de les eleccions.
- **Fotos:** `foto` és l'enllaç a la foto oficial al web del Parlament, a la mida mitjana (fins a 600 px pel costat llarg). No se'n desa cap còpia. L'[avís legal](https://www.parlament.cat/pcat/serveis-parlament/avis-legal) del Parlament en permet la reutilització si se'n cita la font, no se n'altera el sentit i no es presenten com una versió oficial ni avalada pel Parlament. Cal mostrar-les amb «Foto: Parlament de Catalunya». Les condicions també són al camp `fotos` del fitxer.
- **Subgrups:** el mapa mostra els membres d'un subgrup dues vegades, una amb el grup i una altra amb el subgrup. Es comptabilitzen al grup i, a més, al subgrup.

## Pendent

- Els escons que va obtenir cada candidatura a les eleccions del 12 de maig de 2024 s'han de treure dels resultats oficials, que són una altra font.
- Falten les fotos dels membres del Govern que no són diputats. [govern.cat](https://govern.cat/gov/consell-executiu) en publica sota CC0, però de mides i enquadraments diferents.
