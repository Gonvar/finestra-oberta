# Idescat

Servidor MCP de les taules estadístiques de l'[Idescat](https://www.idescat.cat), l'Institut d'Estadística de Catalunya. Fa servir l'[API Taules v2](https://www.idescat.cat/dev/api/taules/), pública i sense clau, en català (`lang=ca`).

```sh
node src/index.ts idescat
```

## Com s'arriba a una dada

L'API no té cap llista plana de taules. És un arbre de quatre nivells:

| Nivell            | Exemple           | Què és                                     |
| ----------------- | ----------------- | ------------------------------------------ |
| Estadística       | `pmh`             | Padró municipal d'habitants                |
| Tema              | `pmh/446`         | Població a 1 de gener, per sexe            |
| Taula             | `pmh/446/477`     | La taula, que pot tenir diversos períodes  |
| Àmbit territorial | `pmh/446/477/com` | Per comarques i Aran (també `cat`, `mun`…) |

Les eines segueixen aquest camí:

1. **`explorar`** baixa per l'arbre. Sense `cami` mostra les estadístiques; amb un camí, el que hi ha a dins. `q` filtra els noms per paraules, sense accents ni majúscules.
2. **`veure_taula`** mostra, d'un camí complet, les dimensions i els seus valors, la data d'actualització, la font i les notes.
3. **`dades_taula`** en torna les dades dels últims períodes (`ultims`). `filtres` tria, per a cada dimensió, els valors que es volen:

```json
{ "cami": "pmh/446/477/com", "filtres": { "COM": "Osona", "SEX": "dones" }, "ultims": 2 }
```

Les dades arriben agrupades en sèries, del període més recent al més antic:

```json
{
  "nom": "Osona · dones",
  "dades": [
    { "periode": "2025", "valor": 82348 },
    { "periode": "2024", "valor": 81532 }
  ]
}
```

## Comportament de l'API que el servidor té en compte

- **Un codi de filtre que no existeix torna dades buides, no un error** (`COM=xx` respon 200). Per això el servidor resol cada filtre amb les metadades de la taula abans de fer la consulta, i torna un error si no troba cap valor.
- **Un filtre es resol primer pel valor exacte** (nom o codi) i, si no n'hi ha cap, per les paraules que conté. «Vic» és Vic, i no també Sant Vicenç dels Horts.
- **El període no es filtra:** es demanen els últims amb `ultims`.
- **Les etiquetes dels períodes no s'ordenen com a text** («T4/2025» quedaria abans de «T2/2026»). S'ordenen pel lloc que ocupen a la taula, que és cronològic.
- **Les dades provisionals** porten `"estat": "Dada provisional"`.
- **Les notes de la taula** expliquen canvis importants, com els de límits comarcals. Les instruccions demanen a l'assistent que les expliqui quan afectin la resposta.
- **Màxim de 1.000 dades per consulta.** Una taula per municipis sense filtrar en té desenes de milers. El servidor calcula la mida amb les metadades i demana filtrar més abans de fer la crida.
- **Alguns temes tenen diverses taules per períodes**, com «(2014–)» i «(2000–2013)». Les instruccions diuen a l'assistent que triï la que arriba fins avui.
- **JSON-stat admet l'índex de les dimensions com a llista o com a objecte.** L'Idescat fa servir la llista, i el servidor accepta totes dues formes.

## Proves

- [src/idescat.test.ts](../src/idescat.test.ts): proves amb dades sintètiques.
- Comprovat contra l'API real per stdio el 22 de novembre de 2026: població per comarca i per municipi, el PIB trimestral, un filtre inexistent i una consulta massa gran.
