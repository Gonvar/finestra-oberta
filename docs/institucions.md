# El Govern i el Parlament

Les dades que canvien poc: qui forma el Govern, què en publica el Portal de la Transparència i com es reparteixen els 135 escons del Parlament. Són a [`dades/`](../dades/) en JSON, perquè la web les pugui mostrar sense consultar les fonts.

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
- **Contingut:** el president i un conseller o consellera per departament, amb el nom, el càrrec, el departament i la retribució anual prevista en euros (`retribucio_anual`).
- **Noms:** la relació els escriu en majúscules i, en alguns casos, sense accents: «PANE MENA, OLGA». El nom ben escrit, «Olga Pané i Mena», surt de les [intervencions del Govern al Parlament](https://analisi.transparenciacatalunya.cat/d/7chp-hkce) (`7chp-hkce`), que té la seva pròpia data (`data_noms`). Totes les paraules del nom oficial han de ser al nom escrit, i ha de coincidir amb un sol nom.
- **Càrrecs:** «Consellera de Salut» es forma amb el sexe i el departament que dona la relació. Tal com els escriu la relació, el nom i el càrrec són a `nom_oficial` i `carrec_oficial`.
- **Comprovacions:**
  - Hi ha d'haver un president, i cada departament ha de tenir un conseller, i només un.
  - Cada persona ha de tenir un nom, i només un, a les intervencions. Una persona que encara no ha intervingut al Parlament atura l'script fins que s'hi afegeixi.
- **Foto i currículum:** `foto` i `cv` surten de les fitxes del [Consell Executiu](https://govern.cat/gov/consell-executiu) a govern.cat, copiades a `dades/perfils-govern.json`. `data_perfils` és el dia en què es van copiar. `foto` és l'enllaç a la foto oficial, sense cap còpia, i `cv` són els paràgrafs del currículum en text pla. Cada membre es troba pel càrrec i els cognoms, i ha de coincidir amb una sola fitxa, amb una sola foto principal i amb un currículum que no sigui buit. Si algú no hi és, l'script s'atura. Segons l'[avís legal](https://govern.cat/gov/avis-legal) de govern.cat, els continguts són CC0. Igualment es mostra d'on surten.

### Com es copien les fitxes de govern.cat

govern.cat no respon als scripts: la seva API, al darrere de CloudFront, torna 403 a qualsevol petició que no vingui d'un navegador, també des d'un ordinador personal. Per això les fitxes es copien a mà, i cal tornar-ho a fer quan canvia el Govern (l'script s'atura si un membre no hi és):

1. Obre <https://govern.cat/gov/consell-executiu> al navegador i, a la consola de les eines de desenvolupament, enganxa:

   ```js
   const r = await (await fetch('/gov/api/v1/consell-executiu?size=100')).json();
   copy(
     JSON.stringify(
       {
         consultat: new Date().toISOString().slice(0, 10),
         total: r.totalElements,
         fitxes: r.content.map((f) => ({
           nom: f.consellerIdioma.nom,
           carrec: f.consellerIdioma.carrec,
           fotos: f.audiovisual.filter((a) => a.tipusImatge === 1).map((a) => a.data),
           cv: f.consellerIdioma.descripcioCV,
         })),
       },
       null,
       2,
     ),
   );
   ```

2. Desa el que s'ha copiat a `dades/perfils-govern.json` (al Mac, `pbpaste > dades/perfils-govern.json`) i executa `npm run dades`.

Només es copien aquests quatre camps. L'API en dona d'altres, com qui va publicar cada fitxa, que no s'han de desar.

## `dades/transparencia.json`

El que la Generalitat publica de cada membre del Govern a més del càrrec i la retribució. Cada apartat porta la seva font i la data de l'última actualització del conjunt (`data_dades`).

- **Fonts**, totes a Dades obertes de Catalunya:
  - [Declaracions d'activitats públiques i privades](https://analisi.transparenciacatalunya.cat/d/vdss-2ppz) (`vdss-2ppz`), de la Secretaria d'Administració i Funció Pública.
  - [Agenda pública amb grups d'interès](https://analisi.transparenciacatalunya.cat/d/hd8k-y28e) (`hd8k-y28e`), de la Direcció General de Govern Obert.
  - [Viatges a l'estranger](https://analisi.transparenciacatalunya.cat/d/5kte-hque) (`5kte-hque`), de la Direcció General de Govern Obert.
- **Llicència:** la de les condicions d'ús de Dades obertes de Catalunya. Els conjunts no en donen cap altra («See Terms of Use»).
- **Contingut de cada persona:**
  - `nomenament`: la data de nomenament que dona la declaració d'activitats.
  - `activitats`: els apartats de la declaració que no diuen «N/A», amb la llista d'activitats. El nom de cada apartat és un resum de la descripció legal que en fa el conjunt.
  - `agenda`: quantes reunions i actes amb grups d'interès hi ha des del nomenament, i els cinc últims. No compten les files sense grup («-»), que la relació fa servir per dir que en un trimestre no n'hi ha hagut cap.
  - `viatges`: quants viatges a l'estranger hi ha des del nomenament, la suma de les despeses publicades, quants encara no en tenen (`sense_despeses`) i els cinc últims.
- **Com es troba cada persona:** pel nom oficial de la relació d'alts càrrecs, com amb els noms ben escrits. L'agenda i els viatges inclouen tots els alts càrrecs i els mandats anteriors, i per això només compten les files amb el càrrec de president o de conseller i a partir del nomenament.
- **Comprovacions:**
  - Cada membre del Govern ha de tenir una declaració d'activitats activa, i només una, amb tots els apartats.
  - Les dates i els imports han de tenir la forma esperada.
  - Cap consulta no pot omplir una pàgina sencera de resultats.
- **Despeses:** es publiquen quan s'han validat, i l'import d'un viatge pot incloure el de la comitiva.

## `dades/parlament.json`

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
- **Colors:** cada grup porta el color amb què el pinta el mapa d'escons. Un color que no tingui la forma d'un color CSS atura l'script.
- **Subgrups:** el mapa mostra els membres d'un subgrup dues vegades, una amb el grup i una altra amb el subgrup. Es comptabilitzen al grup i, a més, al subgrup.

## Pendent

- Les declaracions de béns patrimonials dels membres del Govern no són a Dades obertes de Catalunya. Abans d'afegir-les, cal trobar-ne una font oficial que es pugui llegir sense haver de fer servir les pàgines de cada departament.

- Els escons que va obtenir cada candidatura a les eleccions del 12 de maig de 2024 s'han de treure dels resultats oficials, que són una altra font.
