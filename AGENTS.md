# Instruccions per a agents

Llegeix [CONTRIBUTING.md](CONTRIBUTING.md) abans de canviar res: hi ha com afegir un servidor i els criteris del projecte. Per als límits de seguretat, [SECURITY.md](SECURITY.md).

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
- Tot el que veu l'assistent (instruccions, descripcions, errors) va en català.

## Verificació

- Executa `npm test`, `npm run typecheck` i `npm run format:check`.
- Prova cada canvi d'un servidor contra l'API real per stdio. Si no ho has fet, digues-ho.
- No afirmis mai que una prova o una comprovació s'ha fet si no s'ha fet. Distingeix les proves amb dades sintètiques de les proves contra l'API real.
- Les proves cobreixen el comportament que canvia la tasca, no la forma de la implementació.
- No relaxis una prova ni un límit perquè passi el teu canvi.

## Git

- Títols `tipus(àmbit): resultat concret`, en català.
- No facis commits, pushes ni PR sense que l'usuari ho demani.
- No posis dades personals ni secrets en proves, logs ni commits.
