# Exemples d'ús

Aquests exemples mostren les crides que fa un assistent i les respostes **reals** dels servidors, obtingudes el 22 de novembre de 2026 contra les APIs oficials. S'han escurçat on s'indica (…). Les dades poden haver canviat des de llavors.

## Quina comarca va tenir més morts en accidents de trànsit el 2023?

Amb el servidor `dades-obertes`, l'assistent busca primer el conjunt:

```json
{ "name": "cercar_conjunt", "arguments": { "q": "accidents trànsit morts" } }
```

```json
{
  "total": 3,
  "conjunts": [
    {
      "id": "rmgc-ncpb",
      "nom": "Accidents de trànsit amb morts o ferits greus a Catalunya",
      "organisme": "Departament d'Interior i Seguretat Pública",
      "frequencia": "Anual",
      "dades_actualitzades": "2024-12-05",
      "enllac": "https://analisi.transparenciacatalunya.cat/d/rmgc-ncpb"
    },
    {
      "id": "9yr6-nd4d",
      "nom": "Morts per accidents de trànsit a Catalunya a 30 dies",
      "organisme": "Servei Català de Trànsit (SCT)",
      "frequencia": "Variable",
      "dades_actualitzades": "2025-02-18"
    }
  ]
}
```

De cada conjunt s'han omès la descripció i alguns camps, i també un tercer conjunt sobre fets penals. Després l'assistent agrega a l'API, en lloc de baixar-se els accidents un per un:

```json
{
  "name": "consultar_dades",
  "arguments": {
    "conjunt": "rmgc-ncpb",
    "select": "nomcom, count(*) as accidents, sum(f_morts) as morts",
    "where": "any = 2023",
    "group": "nomcom",
    "order": "morts desc",
    "limit": 3
  }
}
```

```json
{
  "files": [
    { "nomcom": "Barcelonès", "accidents": "331", "morts": "26" },
    { "nomcom": "Vallès Oriental", "accidents": "94", "morts": "19" },
    { "nomcom": "Baix Llobregat", "accidents": "140", "morts": "18" }
  ],
  "total": 3,
  "avis": "S'han retornat les 3 files del límit i pot haver-n'hi més: no és el total. Per comptar, agrega amb count(*)."
}
```

Amb aquestes dades, una bona resposta diria que **el Barcelonès** va tenir més morts el 2023 (26, en 331 accidents greus), seguit del Vallès Oriental i el Baix Llobregat. També hauria de dir dues coses que surten de les respostes:

- Les dades són del Departament d'Interior i es van actualitzar el **5 de desembre de 2024**, tot i que el conjunt diu que s'actualitza cada any.
- Hi ha un altre conjunt, el del Servei Català de Trànsit, que compta els **morts a 30 dies** de l'accident. Les xifres de tots dos conjunts no tenen per què coincidir.

## Quantes dones vivien a Osona l'1 de gener de 2025?

Amb el servidor `idescat`, l'assistent baixa per l'arbre de taules fins al padró per sexe i comarca, i en demana els dos últims anys:

```json
{
  "name": "dades_taula",
  "arguments": {
    "cami": "pmh/446/477/com",
    "filtres": { "COM": "Osona", "SEX": "dones" },
    "ultims": 2
  }
}
```

```json
{
  "taula": "Població a 1 de gener. Per sexe. Comarques i Aran",
  "actualitzada": "2025-12-12",
  "notes": [
    "(…) les dades es presenten segons la distribució territorial vigent en aquell moment: 42 comarques i l'entitat territorial singular Aran. (…)"
  ],
  "series": [
    {
      "nom": "Osona · dones",
      "dades": [
        { "periode": "2025", "valor": 82348 },
        { "periode": "2024", "valor": 81532 }
      ]
    }
  ]
}
```

L'1 de gener de 2025 hi vivien **82.348 dones**, 816 més que un any abans. La nota recorda que els límits comarcals han canviat en els últims anys (per exemple, amb la creació del Lluçanès), i per això la comparació amb anys anteriors s'ha de fer amb compte.

## Què passa quan una cosa no quadra

Un text mal escrit al filtre no torna un zero com si fos real:

```json
{
  "name": "consultar_dades",
  "arguments": {
    "conjunt": "rmgc-ncpb",
    "select": "count(*) as n",
    "where": "any = 2023 and nomcom = 'osona'"
  }
}
```

```json
{
  "files": [{ "n": "0" }],
  "total": 1,
  "avis": "Cap resultat. Abans de dir que no n'hi ha, comprova que els textos del $where s'escriuen exactament com al conjunt (majúscules i accents): consulta els valors amb $select camp, count(*) i $group camp."
}
```

Amb `'Osona'`, en majúscula, el resultat és de 32 accidents.
