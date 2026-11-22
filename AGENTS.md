# Instruccions per a agents

Llegeix [CONTRIBUTING.md](CONTRIBUTING.md) abans de canviar res: hi ha com afegir un servidor i els criteris del projecte. Per als límits de seguretat, [SECURITY.md](SECURITY.md). Per a les fonts i les dades, [NEUTRALITAT.md](NEUTRALITAT.md). Per a qualsevol canvi visual o de text de la interfície, [DESIGN.md](DESIGN.md).

## Idioma: català

**L'idioma del projecte és el català, i tot es fa en català**: el codi que llegeixen els assistents, els noms de les eines i dels paràmetres, els comentaris, la documentació, els commits, les PR, les issues i les respostes a qui hi treballa. No escriguis en castellà ni en anglès encara que la persona o la font ho facin. Només es conserven els identificadors tècnics i els noms dels camps de les APIs.

## Textos de la interfície

- Cada vegada que escriguis o canviïs un text que llegirà la gent a la web (títols, etiquetes, botons, avisos, estats buits, descripcions), passa'l per la skill [`clean-copy`](.claude/skills/clean-copy/SKILL.md) abans de donar-lo per bo. Primer es decideix si el text ha d'existir i després com es diu, i el català i el to de [DESIGN.md](DESIGN.md) §4 també s'hi apliquen.
- Cada revisió d'una pull request que toca la web, també el `/code-review`, fa les preguntes de [DESIGN.md](DESIGN.md) §1.1 i en diu el resultat.

## Abast

- Fes només el que se t'ha demanat. Res de neteges, canvis de format o refactoritzacions alienes a la tasca.
- Tria la solució més senzilla que funcioni. Reutilitza [src/comun.ts](src/comun.ts) abans d'escriure una funció nova i no afegeixis dependències sense preguntar.
- No toquis canvis de l'usuari que no siguin de la tasca.

## Codi

- Valida l'entrada a la frontera (els esquemes de zod de cada eina) i després confia en els tipus.
- Cap `?.`, `??` ni comprovació per a estats que els tipus diuen que no poden passar.
- Captura només els errors que esperes i saps tractar. Mai tornis un valor per defecte per amagar un error: una dada que falta és un error, no un zero.
- Corregeix un defecte on neix, no on es manifesta.
- Els comentaris expliquen per què, mai què fa el codi.
- El projecte fa servir Node 24, que executa el TypeScript directament. No afegeixis suport per a versions anteriors ni cap pas de compilació.

## Neutralitat

- No escriguis ni corregeixis dades a mà, i no afegeixis fonts que no siguin a la taula de [NEUTRALITAT.md](NEUTRALITAT.md).
- Quan revisis una pull request, també amb `/code-review`, fes les comprovacions de NEUTRALITAT.md §4 i digues-ne el resultat. Qualsevol d'aquests casos és una troballa que bloqueja la pull request.

## Verificació

- Executa `npm test`, `npm run typecheck` i `npm run format:check`. Si toques `web/`, executa-hi també `npm run build`.
- Prova cada canvi d'un servidor contra l'API real per stdio. Si no ho has fet, digues-ho.
- No afirmis mai que una prova o una comprovació s'ha fet si no s'ha fet. Distingeix les proves amb dades sintètiques de les proves contra l'API real.
- Les proves cobreixen el comportament que canvia la tasca, no la forma de la implementació.
- No relaxis una prova ni un límit perquè passi el teu canvi.

## Git

- Títols `tipus(àmbit): resultat concret`, en català.
- No facis commits, pushes ni PR sense que l'usuari ho demani.
- No posis dades personals ni secrets en proves, logs ni commits.
