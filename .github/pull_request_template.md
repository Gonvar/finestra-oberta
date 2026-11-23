## Canvi

<!-- Quin problema hi ha, què canvia i què se n'espera. Enllaça la issue si n'hi ha; fes servir «Closes #N» només si la resol. -->

## Verificació

<!-- Les ordres que has executat i el resultat, i les crides contra l'API real. Distingeix les proves amb dades sintètiques de les proves reals. Si toques la web, afegeix captures d'abans i de després, al mòbil i a l'escriptori. No diguis que has fet una comprovació que no has fet. -->

## Neutralitat i fonts

<!-- Vegeu NEUTRALITAT.md. Marca cada punt, o explica per què no es compleix: si no es compleix, la pull request no entra. -->

- [ ] Cap canvi a `dades/` ni a cap fitxer de dades que no surti del workflow de dades.
- [ ] Totes les dades surten de les fonts oficials de NEUTRALITAT.md. Si n'hi ha una de nova, s'hi afegeix i es justifica.
- [ ] El codi no canvia, filtra ni substitueix el que diu la font.
- [ ] Cap text, ordre, color ni resum afavoreix o perjudica cap partit, grup, persona o ideologia.
- [ ] Si canvia `fonts/perfils-govern.json`: s'ha generat amb el fragment de docs/institucions.md, sense cap retoc més que Prettier, i dic quan.

## Font nova

<!-- Només si la pull request afegeix una font; si no, esborra aquesta secció. Vegeu CONTRIBUTING.md, «Afegir una font». -->

- [ ] La font és d'un organisme públic, pública i sense clau, i el seu domini és a NEUTRALITAT.md.
- [ ] L'enllaç a la llicència o les condicions d'ús és la pàgina oficial de la font, i les compleixo.
- [ ] L'he provat contra l'API real per stdio, amb una crida que funciona i una que ha de fallar. Explico quines a «Verificació».

## Senzillesa

<!-- Vegeu DESIGN.md §1.1. Només si la pull request toca la web; si no, esborra aquesta secció. -->

- [ ] Una persona que no sap com funciona l'Administració entén cada pàgina a la primera.
- [ ] Cada terme tècnic s'explica i cada frase és tan curta com pot.
- [ ] Cada element respon una pregunta útil.
- [ ] El que és visual ajuda a entendre una dada.
- [ ] Funciona al mòbil, amb el teclat, amb un lector de pantalla i amb el text ampliat al 200 %, i compleix DESIGN.md §5.

## Impacte

<!-- Canvis en les eines, les instruccions o les dades que reben els assistents, i limitacions conegudes. Esborra aquesta secció si no cal. -->

## Ajuda d'un agent

<!-- Si un agent d'IA hi ha contribuït de manera important, digues quin i què ha fet (codi, proves o revisió). Si no, escriu «No». -->

<!-- Digues si s'hi ha passat `/code-review` en una sessió independent i què se n'ha corregit. -->
