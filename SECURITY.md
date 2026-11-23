# Seguretat i privacitat

## Què fan els servidors

Els servidors MCP s'executen a l'ordinador de qui els fa servir, per stdio. No hi ha cap servidor nostre al mig.

- Només llegeixen APIs públiques: `api.idescat.cat`, `analisi.transparenciacatalunya.cat`, `opendata-ajuntament.barcelona.cat`, `dadesobertes.fgc.cat`, `data.renfe.com` i `gtfsrt.renfe.com`, sense clau, i `api.tmb.cat`, amb la clau gratuïta de qui fa servir el servidor.
- La clau de TMB es llegeix de les variables d'entorn `TMB_APP_ID` i `TMB_APP_KEY`. Viatja a TMB a l'adreça de cada crida, com demana la seva API, i no surt mai en cap resposta ni en cap error.
- L'històric del transport es publica a `historic.finestraoberta.cat`, un bucket R2 de Cloudflare que es pot llegir però no escriure sense clau. Només el workflow `transport.yml` hi escriu, amb un token limitat a aquest bucket que és un secret de l'entorn `dades`, igual que la clau de TMB.
- Totes les eines són de només lectura (`readOnlyHint`). Cap eina escriu, envia formularis ni fa tràmits.
- No guarden res: ni les preguntes, ni les respostes, ni cap dada de qui els fa servir.
- No hi ha analítica ni telemetria.
- Els errors interns no s'expliquen a l'assistent, perquè podrien contenir URL o detalls interns. Només arriben els errors de la font, escrits per nosaltres.

El que demana l'assistent sí que arriba a l'API oficial: per exemple, el nom d'un municipi o el text d'una consulta SoQL. No escriguis dades personals en aquestes consultes.

## Com es publica la web

La web de `web/` és estàtica i no té codi de servidor: Cloudflare Workers serveix els fitxers que genera Astro.

- Workers Builds, connectat a aquest repositori, publica [finestraoberta.cat](https://finestraoberta.cat) cada vegada que canvia la branca `main` i cada vegada que el workflow de dades publica dades noves. El workflow ho fa amb un deploy hook, que només pot llançar una compilació de `main`. El repositori no té cap ordre per publicar a mà, però la persona que administra el compte de Cloudflare encara ho podria fer amb `wrangler deploy`.
- `main` està protegida i els canvis hi arriben per pull requests que han passat la CI. Els administradors del repositori es poden saltar aquesta protecció.
- Cloudflare desa el commit de cada versió publicada. Ara per ara, aquest registre només es veu al tauler de Cloudflare, no a la web.
- El repositori no conté secrets i el codi de `web/` no llegeix cap variable d'entorn. Workers Builds publica amb un token d'API que guarda Cloudflare. L'URL del deploy hook és el secret `CLOUDFLARE_DEPLOY_HOOK` de l'entorn `dades` de GitHub, que només s'obre per a execucions de `main`.
- La branca de producció i les previsualitzacions es configuren al tauler de Cloudflare (Workers, `finestra-oberta`, Configuració, Compilacions), no en aquest repositori.

## Fiabilitat de les dades

Les respostes contenen dades oficials, però un assistent les pot interpretar malament. Cada resposta porta la font i la data de les dades perquè es puguin comprovar. Si trobes una dada mal presentada, obre una issue.

## Informar d'un problema de seguretat

Fes servir el [canal privat de GitHub](https://github.com/Gonvar/finestra-oberta/security/advisories/new). No publiquis els detalls en una issue oberta.

No incloguis dades personals, tokens ni sessions en issues, proves ni captures.
