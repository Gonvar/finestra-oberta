# Seguretat i privacitat

## Què fan els servidors

Els servidors MCP s'executen a l'ordinador de qui els fa servir, per stdio. No hi ha cap servidor nostre al mig.

- Només llegeixen APIs públiques i sense clau: `api.idescat.cat` i `analisi.transparenciacatalunya.cat`.
- Totes les eines són de només lectura (`readOnlyHint`). Cap eina escriu, envia formularis ni fa tràmits.
- No guarden res: ni les preguntes, ni les respostes, ni cap dada de qui els fa servir.
- No hi ha analítica ni telemetria.
- Els errors interns no s'expliquen a l'assistent, perquè podrien contenir URL o detalls interns. Només arriben els errors de la font, escrits per nosaltres.

El que demana l'assistent sí que arriba a l'API oficial: per exemple, el nom d'un municipi o el text d'una consulta SoQL. No escriguis dades personals en aquestes consultes.

## Fiabilitat de les dades

Les respostes contenen dades oficials, però un assistent les pot interpretar malament. Cada resposta porta la font i la data de les dades perquè es puguin comprovar. Si trobes una dada mal presentada, obre una issue.

## Informar d'un problema de seguretat

Fes servir el [canal privat de GitHub](https://github.com/Gonvar/finestreta-oberta/security/advisories/new). No publiquis els detalls en una issue oberta.

No incloguis dades personals, tokens ni sessions en issues, proves ni captures.
