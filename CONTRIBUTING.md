# Contribuir

Gràcies per voler ajudar. Pots contribuir sense escriure codi:

- Explica on t'has encallat amb una web o unes dades de l'Administració catalana, sense compartir dades personals.
- Proposa una font de dades obertes que valgui la pena connectar.
- Revisa les respostes d'un servidor: una dada mal interpretada, una nota que no s'explica, una data que falta.

Obre una [issue](https://github.com/Gonvar/finestra-oberta/issues) per a qualsevol d'aquestes coses. Per a preguntes i idees que encara no són una tasca concreta, fes servir les [Discussions](https://github.com/Gonvar/finestra-oberta/discussions).

Tothom que hi participa segueix el [codi de conducta](CODE_OF_CONDUCT.md).

## Per on començar

Les issues amb l'etiqueta [`good first issue`](https://github.com/Gonvar/finestra-oberta/labels/good%20first%20issue) són petites i ben definides. Si en vols agafar una, digues-ho a la issue perquè ningú no hi treballi alhora. Abans d'un canvi gran, obre una issue o una discussió per acordar-ne l'enfocament.

## Com proposar un canvi

1. Fes un fork del repositori i crea-hi una branca amb un nom curt que digui què fa, per exemple `fix/idescat-dates`.
2. Fes el canvi, amb les proves que calguin (vegeu [Preparar l'entorn](#preparar-lentorn)).
3. Obre una pull request contra `main` i omple la plantilla.
4. La CI comprova les proves, els tipus, el format i la compilació de la web. Si toques `web/` des d'una branca d'aquest repositori (no d'un fork), Cloudflare publica una previsualització de la branca i n'enllaça l'adreça a la pull request.
5. Una persona que manté el projecte la revisa. Tota pull request entra a `main` amb la CI en verd.

## L'idioma del projecte és el català

**Tot es fa en català**: el codi que llegeixen els assistents (instruccions, descripcions de les eines i errors), els comentaris, la documentació, els commits, les pull requests, les issues i les revisions. Es conserven tal com són els identificadors tècnics i els noms dels camps de les APIs.

Si no escrius en català, pots obrir una issue en castellà o en anglès i t'hi respondrem en català. Les contribucions que entren al repositori, però, han d'estar en català.

## Preparar l'entorn

Cal **Node.js 24 o posterior**. Node executa el TypeScript directament, sense compilar.

```sh
npm install
npm test             # proves amb dades sintètiques
npm run typecheck    # TypeScript
npm run format       # Prettier
```

## Canviar la interfície

La web és a `web/`: un lloc estàtic fet amb [Astro](https://astro.build) que es publica a Cloudflare Workers.

```sh
cd web
npm install
npm run dev          # servidor local amb recàrrega
npm test             # les proves de la web
npm run build        # la compilació que fa la CI
npm run preview      # la web compilada, servida com a Cloudflare
```

Tot el que es veu a la web (colors, tipografia, components i textos) segueix [DESIGN.md](DESIGN.md). Si un canvi necessita una regla que no hi és, proposa-la a la mateixa pull request.

Cada pàgina fa servir la plantilla `web/src/layouts/Pagina.astro` i ha de ser a `web/src/dades/pagines.ts`, amb el títol, la descripció i el text de la imatge que es veu quan algú comparteix l'enllaç. La imatge es genera al build; sense l'entrada, el build falla.

- Els textos han de passar per la skill [`clean-copy`](.claude/skills/clean-copy/SKILL.md): primer es decideix si un text ha d'existir i després com es diu.
- Comprova el canvi a 320 px d'amplada i a l'escriptori, amb el teclat i amb el contrast de DESIGN.md §5.
- Afegeix captures d'abans i de després a la pull request quan el canvi es vegi.

## Afegir un servidor MCP

Cada servidor és un fitxer a `src/` que exporta una funció `create…Server(fetchImpl = fetch)` i torna un `McpServer`. Per exemple, [src/idescat.ts](src/idescat.ts) o [src/dadesobertes.ts](src/dadesobertes.ts).

1. **Estudia l'API real abans d'escriure.** Fes algunes crides a mà i apunta què passa amb un paràmetre que no existeix, un identificador inexistent, una consulta massa gran i les dades provisionals o antigues.
2. **Escriu el servidor a `src/<font>.ts`.**
   - Fes servir `run`, `getJson`, `SourceError` i `READ_ONLY_EXTERNAL` de [src/comun.ts](src/comun.ts).
   - Escriu les instruccions, les descripcions de les eines, els errors i els noms de les eines i dels paràmetres en català.
   - Tota eina és de només lectura.
3. **Registra'l a [src/index.ts](src/index.ts)** i afegeix-ne l'script a `package.json`.
4. **Afegeix proves a `src/<font>.test.ts`** amb `node:test` i un `fetch` fals. Fes servir dades sintètiques amb la forma de l'API, no captures reals.
5. **Prova'l contra l'API real** per stdio, amb una crida que funcioni i amb una que hauria de fallar.
6. **Documenta'l a `docs/<font>.md`** i afegeix-lo a la taula del [README](README.md).

## Criteris

Aquest projecte publica dades públiques. Una dada falsa que sembla real és desinformació:

- **Cap valor per defecte que amagui un error.** Si la font falla o no té la dada, l'assistent ho ha de saber. Un zero, una llista buida o una dada antiga no poden semblar una resposta vàlida.
- **Valida el que l'API no valida.** Si un filtre mal escrit torna dades buides sense cap error, comprova'l abans contra les metadades o avisa'n a la resposta.
- **Dona sempre la data de les dades**, i no la freqüència d'actualització que anuncia el conjunt.
- **Els errors de la font es poden explicar a l'assistent; els interns, no.** Fes servir `SourceError` només per a missatges sense URL ni detalls interns.
- **Cita la font** a cada resposta.
- **El mínim codi que funcioni.** Reutilitza el que hi ha a `comun.ts` abans d'escriure una funció nova, i no afegeixis dependències per al que es pot fer amb unes poques línies.
- **Els comentaris expliquen per què, no què fa el codi.**
- **Només hi pot haver sintaxi de TypeScript que es pugui esborrar** (`erasableSyntaxOnly`), i els imports porten l'extensió `.ts`.

## Commits i pull requests

- Títols amb el format `tipus(àmbit): resultat concret`, en català. Per exemple: `feat(idescat): afegeix els indicadors anuals`. Els tipus són `feat`, `fix`, `docs`, `refactor`, `test`, `perf` i `chore`.
- Els àmbits són el nom del servidor (`idescat`, `dades-obertes`, `barcelona`), `web`, `dades`, `design`, `ci` o `docs`.
- Les pull requests de Dependabot són l'excepció: el títol i l'àmbit (`deps`) els genera Dependabot, en anglès («bump … from … to …»).
- Un objectiu per pull request. Les pull requests s'integren amb _squash_, i el títol de la pull request és el del commit final.
- Omple la [plantilla](.github/pull_request_template.md): què canvia, com ho has comprovat i si t'ha ajudat un agent d'IA.
- No diguis que has provat una cosa que no has provat. Les proves amb dades sintètiques no substitueixen una prova contra l'API real.
- Abans de la revisió, qui manté el projecte passa `/code-review` de Claude Code a cada pull request nova, en una sessió independent i mai en la que ha escrit el canvi, també quan la pull request l'obre una sessió de Claude. Se'n revisen les troballes i se'n corregeixen les que siguin correctes.

Si treballes amb un agent d'IA, llegeix també [AGENTS.md](AGENTS.md).
