# `resums.json`: què va passar a cada sessió del Ple

Un resum en català planer de cada sessió del Ple de la legislatura en curs, perquè qualsevol persona entengui de què es va parlar i què es va decidir sense haver de llegir l'ordre del dia sencer. **L'escriu un model d'IA**, no el Parlament ni ningú del projecte. El text que val és sempre el del Parlament, enllaçat a cada resum. Les regles són a [NEUTRALITAT.md](../NEUTRALITAT.md) §5.

## Què llegeix el model

Només els punts de la sessió tal com són a `activitat.json`: el número, el caràcter i la data de la sessió, i el títol i l'acord de cada punt. [`entrada`](../src/resums.ts) ho escriu sempre igual. El model no fa cerques ni llegeix cap altra web, i no veu vots ni assistència, perquè el Parlament no els publica (vegeu [institucions.md](institucions.md#activitatjson)).

## Com es fa

- **Model:** Claude Haiku 5.5 (`claude-haiku-5-5`), d'Anthropic, amb l'esforç baix (`effort: low`). És el model petit i barat: per resumir una llista de punts n'hi ha prou.
- **Instruccions:** `INSTRUCCIONS` a [src/resums.ts](../src/resums.ts). Es publiquen tal com són a `resums.json` i a la web.
- **Quan:** el [workflow de dades](../.github/workflows/dades.yml), al job que publica, després de llegir les fonts. La clau de l'API és el secret `ANTHROPIC_API_KEY` de l'entorn `dades`, que només s'obre per a `main`.
- **Quan es torna a fer:** un resum es reaprofita mentre no canviïn els punts de la sessió, les instruccions ni el model. Si canvia qualsevol d'aquestes tres coses, es torna a fer. Així el text d'una sessió no canvia cada dia i només es paga el que és nou.

## Què es comprova

Un resum no es publica, i la sessió es queda sense resum fins a l'execució següent, si:

- l'API falla o el model s'atura abans d'acabar;
- el text és buit o té més de 1.500 caràcters;
- el text fa servir una de les paraules que jutgen de `VALORACIONS` («polèmic», «històric», «fracàs»…).

Una sessió sense resum no atura la publicació de les dades oficials: el registre de la tasca ho avisa amb un `warning`, i l'endemà es torna a provar.

## Camps

- `avis`: que el text és d'una IA i com es calcula l'empremta.
- `model` i `instruccions`: el model demanat i les instruccions exactes.
- `resums`: un per sessió, de la més nova a la més antiga.
  - `sessio` i `data`: el número i el dia de la sessió, com a `activitat.json`.
  - `font`: els acords de la sessió al web del Parlament.
  - `model`: el model que ha respost, tal com el diu l'API.
  - `generat`: el dia que es va fer el resum.
  - `empremta`: el SHA-256 de `JSON.stringify([model, instruccions, entrada])`.
  - `text`: el resum.

## Com comprovar un resum

El text d'un model no es pot reproduir byte a byte com les dades. El que sí que es pot comprovar és que el resum correspon a la sessió publicada i a les instruccions publicades:

```sh
node -e '
import("./src/resums.ts").then(async ({ empremta }) => {
  const fs = await import("node:fs");
  const { sessions } = JSON.parse(fs.readFileSync("dades/activitat.json"));
  const { resums } = JSON.parse(fs.readFileSync("dades/resums.json"));
  for (const r of resums)
    console.log(r.sessio, empremta(sessions.find((s) => s.numero === r.sessio)) === r.empremta);
});'
```

`resums.json` també porta una atestació de GitHub, com `procedencia.json`, que diu quin workflow i quin commit de `main` l'han escrit.
