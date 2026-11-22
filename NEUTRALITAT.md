# Neutralitat i fonts oficials

Finestra Oberta mostra què fan el Govern, el Parlament i les administracions catalanes. Perquè se'n pugui fiar tothom, voti el que voti, el projecte no pren partit. Aquestes regles valen per a tothom que hi contribueix, també per a qui el manté i per als agents d'IA. **Una pull request que en trenqui alguna no entra a `main`.**

## 1. Només fonts oficials

Les dades surten només dels organismes públics que les publiquen. Ni mitjans de comunicació, ni partits, ni fundacions, ni la Viquipèdia, ni enquestes privades, ni dades escrites de memòria.

Aquests són els dominis que el codi de `src/` pot consultar. [src/fonts.test.ts](src/fonts.test.ts) llegeix aquesta taula i falla si el codi de `src/` conté l'adreça d'un domini que no hi és, o una adreça muntada a trossos.

| Domini                       | Qui el publica                           |
| ---------------------------- | ---------------------------------------- |
| `idescat.cat`                | Institut d'Estadística de Catalunya      |
| `transparenciacatalunya.cat` | Generalitat de Catalunya (Dades obertes) |
| `govern.cat`                 | Generalitat de Catalunya (Govern)        |
| `gencat.cat`                 | Generalitat de Catalunya                 |
| `parlament.cat`              | Parlament de Catalunya                   |
| `barcelona.cat`              | Ajuntament de Barcelona (Open Data BCN)  |

Un domini inclou els seus subdominis: `api.idescat.cat` entra amb `idescat.cat`.

**Per afegir una font**, la pull request ha de:

- Afegir-ne el domini a la taula, amb l'organisme públic que el publica.
- Explicar per què cal i per què no serveix cap de les fonts que ja hi ha.
- Documentar-la a `docs/` amb l'enllaç a l'avís legal o la llicència que en permet la reutilització.

## 2. Les dades no les escriu ningú a mà

Les dades del Govern, del Parlament i dels ajuntaments les genera el [workflow de dades](.github/workflows/dades.yml) a partir de les fonts i es publiquen a la branca `dades`, amb una còpia de cada resposta oficial i una atestació de GitHub. Qualsevol persona pot comprovar que surten de la font (vegeu [docs/institucions.md](docs/institucions.md)), llevat de les fitxes de govern.cat, que es copien a mà i no tenen aquesta còpia (vegeu més avall).

- **Cap pull request no pot afegir ni canviar fitxers a `dades/`.** La CI ho comprova i falla.
- **El codi no pot corregir la font.** Res de taules que reescriguin un nom, un càrrec, un grup, un partit, un escó o una xifra que la font dona d'una altra manera. Si la font s'equivoca, es demana a l'organisme que la corregeixi, i mentrestant es mostra tal com és, o l'script s'atura.
- **Transformar no és editar.** Es pot canviar el format (posar accents a un nom en majúscules, formar «Consellera de Salut» a partir del sexe i el departament), sempre que el resultat surti de la font, la regla estigui documentada i el valor original es conservi al costat.
- **Filtrar només amb criteris objectius.** Es pot deixar fora una fila amb un criteri documentat i igual per a tothom (per exemple, una fila que la font marca com a buida), mai per qui és o per què diu.

### L'única còpia feta a mà: `fonts/perfils-govern.json`

govern.cat no deixa que cap script en llegeixi les fitxes del Consell Executiu, i per això algú les copia des del navegador amb el fragment de [docs/institucions.md](docs/institucions.md). És l'única entrada que no és automàtica. Per això:

- El fitxer només es pot canviar amb el fragment documentat. Després només s'hi passa Prettier, com a tots els fitxers del repositori.
- La pull request que el canvia diu quan es va copiar.
- Qui revisa la pull request torna a executar el fragment a govern.cat, hi passa Prettier i comprova que el contingut és el mateix, llevat de la data de consulta. La CI ho recorda amb un avís a cada pull request que el toca.

Qualsevol altra font que s'hagi de copiar a mà necessita una excepció com aquesta, escrita en aquest document i acceptada en una pull request pròpia.

## 3. Res que afavoreixi o perjudiqui ningú

Això val per al codi, la web, la documentació i les respostes dels servidors MCP.

- **Ordre:** el de la font oficial o un criteri objectiu i explicat (escons, ordre alfabètic, data). Mai un ordre triat per destacar o amagar un grup.
- **Colors:** els dels grups parlamentaris surten de la font, com el mapa d'escons del Parlament, i no s'escriuen al codi. Els colors de la web són els de [DESIGN.md](DESIGN.md) i no representen cap partit.
- **Textos i resums:** descriuen, no valoren. Res d'adjectius que jutgin («polèmic», «històric», «fracàs»), ni d'atribuir intencions, ni de triar quines dades es mostren d'un grup i quines d'un altre. Totes les persones i tots els grups es mostren amb els mateixos camps i el mateix format.
- **Omissions:** si una dada no hi és per a algú, es diu que no hi és, igual per a tothom.

## 4. Què mira cada revisió

Tota revisió d'una pull request, també el `/code-review` de Claude Code, busca explícitament:

1. Canvis a `dades/` o a qualsevol fitxer de dades que no surti del workflow.
2. Fonts noves que no siguin oficials, o adreces que no siguin a la taula de §1.
3. Codi que canviï, filtri o substitueixi el que diu la font.
4. Textos, ordres, colors o resums que afavoreixin o perjudiquin un partit, un grup, una persona o una ideologia.
5. Canvis a `fonts/perfils-govern.json`: s'ha de poder reproduir amb el fragment documentat.

Qualsevol d'aquests casos **bloqueja la pull request** fins que es corregeix. Si qui revisa no ho pot comprovar, ho diu a la revisió i la pull request espera.

## Si veus un biaix

Obre una [issue](https://github.com/Gonvar/finestra-oberta/issues) amb l'enllaç a la pàgina o a la resposta, i a la font oficial que diu una altra cosa. Es tracta com un error.
