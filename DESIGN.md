# Finestra Oberta · Sistema de disseny

Versió 1.0 · 22 de novembre de 2026

La direcció es diu **Silenci**, amb la paleta **Institucions**. La referència visual és la [portada de mostra](https://claude.ai/artifact/D7dvtutK1o8NQe3rFGamq9), feta amb dades reals.

Aquest document és la font de veritat per a tota la interfície de la web. Quan una decisió no hi surti, segueix els principis i pregunta abans d'inventar-ne una de nova.

## 1. Principis

1. **Entendre-ho d'un cop d'ull.** Primer la decisió o la xifra; el detall, a sota. Qualsevol persona, sense saber com funciona l'Administració, ha d'entendre què ha passat.
2. **La font, sempre a la vista.** Cada dada diu d'on ve i de quan és. Una dada sense font no es publica.
3. **Elegant vol dir silenciós.** Molt d'aire, tipografia gran i poques peces. El color té un significat (§2.1) i no decora.
4. **Res que sembli fet per IA.** La web ha de semblar feta per algú amb criteri. La llista de coses que no es fan és a §6.
5. **Per a tothom.** WCAG 2.2 AA com a mínim, el mòbil primer i controls nadius.
6. **Feta també per a la IA.** Cada secció té el seu servidor MCP, i la web explica com connectar-lo.

## 2. Tokens

### 2.1 Color

Cada institució té un color, i **només un**. Aquest color identifica la secció a tota la web: als blocs de la portada, als punts de la cronologia, a les etiquetes i als enllaços de la secció.

| Token        | Hex       | Ús                                                                         | Contrast                                     |
| ------------ | --------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| `--gov`      | `#1F5BD8` | Govern. També és l'accent general: enllaços, focus, botons de la IA        | 5,92:1 amb blanc · 5,32:1 sobre `--gov-tint` |
| `--gov-tint` | `#EEF3FD` | Fons suau de la secció Govern i del bloc «Per a la teva IA»                | decoratiu                                    |
| `--par`      | `#A3192F` | Parlament                                                                  | 7,67:1 amb blanc · 6,83:1 sobre `--par-tint` |
| `--par-tint` | `#FBEFEF` | Fons suau de la secció Parlament                                           | decoratiu                                    |
| `--dad`      | `#0E7A59` | Dades i estadística                                                        | 5,32:1 amb blanc · 4,81:1 sobre `--dad-tint` |
| `--dad-tint` | `#EBF6F1` | Fons suau de la secció Dades                                               | decoratiu                                    |
| `--ink`      | `#1D1D1F` | Text principal i botó principal                                            | 16,83:1 sobre blanc                          |
| `--ink-2`    | `#424245` | Text secundari                                                             | 10,01:1 sobre blanc                          |
| `--ink-3`    | `#6E6E73` | Dates, fonts i metadades. **Mai** sobre `--bg-2` en text de menys de 18 px | 5,07:1 sobre blanc · 4,66:1 sobre `--bg-2`   |
| `--bg`       | `#FFFFFF` | Fons de la pàgina                                                          | —                                            |
| `--bg-2`     | `#F5F5F7` | Cercador, xips, superfícies secundàries                                    | —                                            |
| `--hair`     | `#E8E8ED` | Línies que separen files                                                   | decoratiu                                    |

Regles:

- **El color ocupa espai només en blocs sencers**: els tres blocs de les institucions de la portada i, dins de cada secció, la seva capçalera. A la resta, el color de la institució apareix com a punt, etiqueta o enllaç, mai com a fons de targetes.
- **El text sobre color és sempre blanc**, i només sobre `--gov`, `--par` o `--dad`.
- **No hi ha cap altre color de marca.** No s'hi afegeixen grocs, taronges ni degradats. Per als estats d'error, d'avís i d'èxit es fan servir tons semàntics a part, que no es confonguin amb cap institució.
- **El color mai és l'únic indicador.** Cada punt de color té al costat el nom del tipus («Acord del Govern», «Parlament», «Reunió»).
- Cada valor nou es comprova amb el càlcul de contrast de WCAG abans d'entrar en aquesta taula.

### 2.2 Tipografia

S'usa **la font del sistema** (San Francisco a Apple, Segoe UI a Windows i Roboto a Android):

```css
font-family:
  -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', sans-serif;
```

No es carrega cap font externa. La del sistema ja té els ajustos òptics de cada mida, i així la pàgina es veu de seguida i no fa cap petició a tercers. Per a codi i adreces: `ui-monospace, 'SF Mono', Menlo, monospace`.

| Rol                   | Mida                       | Pes | Interlineat | Espaiat   |
| --------------------- | -------------------------- | --- | ----------- | --------- |
| Títol de portada      | `clamp(48px, 8.4vw, 96px)` | 600 | 1,02        | −0,045 em |
| Xifra gran            | `clamp(44px, 5vw, 60px)`   | 600 | 1           | −0,04 em  |
| Títol de secció       | 32 px                      | 600 | 1,1         | −0,03 em  |
| Títol de bloc         | 30 px                      | 600 | 1,1         | −0,03 em  |
| Text destacat (files) | 19 px                      | 400 | 1,45        | −0,012 em |
| Text                  | 17 px                      | 400 | 1,5         | −0,01 em  |
| Secundari i metadades | 14–15 px                   | 400 | 1,4         | 0         |
| Font de la dada       | 12 px                      | 400 | 1,4         | 0         |

- **L'espaiat depèn de la mida:** negatiu als títols grans, zero al text petit. Mai un sol valor per a totes les mides.
- **La jerarquia surt del pes, la mida i l'interlineat junts.** Només hi ha dos pesos: 400 i 600.
- **El títol de portada té dues línies:** la primera en `--ink` i la segona en `--gov` («Què decideix el Govern. / Ara, a la vista.»).
- Les xifres que s'alineen porten `font-variant-numeric: tabular-nums`.
- Les mides van en `rem` a la implementació, perquè la pàgina respecti la mida de text de cada persona.

### 2.3 Espai, forma i profunditat

- **Contingut:** 1.080 px d'amplada màxima, amb un marge lateral de 20 px com a mínim (`max(20px, env(safe-area-inset-*))`).
- **Separació entre seccions:** 104 px a l'escriptori i 72 px al mòbil. El blanc separa; no calen línies.
- **Radis:** 22 px per als blocs d'institució, 28 px per al bloc de la IA, 14 px per al cercador, 12 px per al codi i 999 px per als xips i els botons rodons.
- **Sense vores ni ombres en repòs.** Una fila es separa de la següent amb una línia interior d'1 px en `--hair` (`box-shadow: inset 0 1px 0`). L'ombra només apareix en un estat: el cercador quan té el focus.
- **Barra de navegació translúcida:** `rgba(255,255,255,0.72)` amb `backdrop-filter: saturate(180%) blur(20px)`, i el contingut passa per sota.

### 2.4 Moviment

Segueix les skills d'Emil Kowalski que hi ha a `.claude/skills/`.

- **Corba:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`. Mai `ease-in` en una entrada.
- **Durades:** 160 ms per a l'estat dels botons i 220 ms per al moviment dels blocs. L'entrada de la pàgina dura 520 ms, amb un desplaçament de 10 px i un retard de 60 ms entre elements.
- **En prémer:** `transform: scale(0.97)` als botons i `scale(0.985)` als blocs grans.
- **Només s'animen `transform` i `opacity`.** Mai `transition: all`.
- Amb `prefers-reduced-motion: reduce` desapareixen les entrades, i els canvis d'estat queden sense animació.
- Res fa esperar: cap animació no bloqueja l'ús de la pàgina.

## 3. Components

| Component              | Com és                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Navegació**          | Barra translúcida de 52 px. A l'esquerra, el logotip (quatre quadrets com els vidres d'una finestra, tres amb els colors de les institucions i un en `--ink`) i el nom en pes 600. A la dreta, les seccions en 13 px.                      |
| **Cercador**           | 56 px d'alçada, fons `--bg-2` i radi de 14 px. A dins, una lupa, el camp i el botó «Pregunta» en `--ink`. El _placeholder_ és una pregunta d'exemple, sense «per exemple:» al davant. A sota, tres xips amb preguntes freqüents.           |
| **Bloc d'institució**  | Un bloc sencer de color, amb el títol, una frase i la xifra de la secció amb el seu període. Tot el bloc és un enllaç, amb una fletxa a dalt a la dreta dins d'un cercle blanc al 18 %. En aquesta pàgina és l'únic lloc on hi ha fletxes. |
| **Fila de cronologia** | Dues columnes: la data (110 px, `--ink-3`) i el contingut. El contingut té l'etiqueta del tipus, amb el punt de color de la institució, la frase en 19 px i, a sota, qui ho fa i d'on ve, en `--ink-3`. Al mòbil, una sola columna.        |
| **Xifra**              | El número gran, i a sota què és i de quan. Sempre amb la font a prop.                                                                                                                                                                      |
| **Bloc per a la IA**   | Fons `--gov-tint`, l'adreça MCP en monoespaiada sobre blanc, un botó «Copia» en `--gov` i un exemple real de conversa.                                                                                                                     |
| **Peu**                | Una línia: «projecte independent, sense vinculació amb cap administració» i el crèdit a Reforma Digital.                                                                                                                                   |

Quan es construeixi la web: es farà amb [Base UI](https://base-ui.com) per als components accessibles (diàlegs, menús i desplegables), [cmdk](https://cmdk.paco.me) per al cercador ⌘K i [Sonner](https://sonner.emilkowal.ski) per als avisos. Cap component no es fa a mà si una d'aquestes llibreries ja el resol.

El moviment dels components de Base UI es fa amb [Animate UI](https://animate-ui.com), que s'hi afegeix sense canviar-ne l'estructura ni l'API. Té tres condicions:

- **Les corbes i les durades són les de §2.4**, no pas les que porta Animate UI per defecte.
- **Es fa servir com a paquet npm** (`@animate-ui/react`), sense copiar-ne els components al repo. La seva llicència (MIT amb la Commons Clause) no deixa redistribuir els components tal com són, i el repo és públic.
- **Els estils surten dels tokens de §2**, no pas de Tailwind ni dels estils de shadcn/ui.

## 4. Text

- **Tot en català**, amb frases curtes i paraules de tots els dies: «Què ha aprovat el Govern», no pas «Acords adoptats en sessió».
- **Abans d'escriure un text, comprova si ha d'existir**, amb la skill [`clean-copy`](.claude/skills/clean-copy/SKILL.md). No hi van els textos que repeteixen una etiqueta, que expliquen un botó que ja es veu, que fan l'elogi del producte («explicat amb claredat») o que s'avancen a un dubte que ningú no tenia.
- **El que sí que hi va:** el període i la font al costat d'una xifra, i el que vol dir un estat buit i què es pot fer.
- **Neutralitat política.** Els exemples i els destacats no prenen partit. Davant del mateix fet, es dona el mateix tractament a tots els grups.

## 5. Accessibilitat

- Contrast AA comprovat per a cada parella de color (§2.1).
- Focus visible: un contorn de 2 px en `--gov` amb 3 px de separació.
- Els objectius tàctils fan 44 px com a mínim, inclosos els xips (a la portada de mostra encara en fan 32).
- Cada camp té una etiqueta, encara que no es vegi (`aria-label`). El _placeholder_ no fa d'etiqueta.
- La pàgina no es desplaça mai en horitzontal, de 320 px en amunt.

## 6. El que no es fa

Són els recursos que fan que una web sembli feta per IA. Venen de la primera maqueta, que es va descartar per aquest motiu.

- Etiquetes en forma de píndola damunt de cada bloc, i targetes amb vora per tot arreu.
- Fletxes «→» com a vinyetes de llista.
- Ombres dures desplaçades («neobrutalisme»).
- Subratllat de retolador groc sobre els títols.
- Etiquetes en majúscules i monoespaiada damunt de cada secció.
- Degradats de color al fons o als títols.
- Emojis com a icones de secció.
- Tot centrat.
- Gràfics de barres decoratius que no responen cap pregunta.

## 7. Com canviar aquest document

Una regla nova surt d'una correcció o d'una decisió de la persona que porta el projecte, i diu per què. Per incorporar-la, fes servir la skill `learn-taste`. Si es pot comprovar amb codi (un color fora de la taula, un `transition: all`), proposa també una regla de lint.
