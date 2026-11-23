# Open Data BCN

Servidor MCP d'[Open Data BCN](https://opendata-ajuntament.barcelona.cat), el portal de dades obertes de l'Ajuntament de Barcelona. Fa servir la seva [API CKAN](https://docs.ckan.org/en/latest/api/), pública i sense clau.

Està adaptat del servidor d'Open Data BCN que es va proposar a Reforma Digital a [samuelcorsan/reforma-digital#265](https://github.com/samuelcorsan/reforma-digital/pull/265), traduït al català i preparat per funcionar per stdio.

```sh
node src/index.ts barcelona
```

## Eines

1. **`cercar_conjunt`** busca conjunts per paraules del títol, la descripció o les etiquetes, en català o en castellà i sense distingir accents. De cadascun dona l'id, el títol en català, la freqüència i quants recursos es poden consultar fila a fila.
2. **`veure_conjunt`** mostra la descripció, l'organisme, la font, la llicència i els recursos consultables, del període més recent al més antic, de 20 en 20 (`des_de` en salta).
3. **`consultar_dades`** torna les files d'un recurs, amb els seus camps i el total de files que compleixen la consulta. Amb `limit: 0` només en dona els camps:

```json
{
  "recurs": "3057b89d-9713-4001-8f07-a6fb122a152b",
  "filtres": { "Nom_Districte": "Gràcia", "SEXE": 2 },
  "limit": 1
}
```

## Comportament de l'API que el servidor té en compte

- **Les peticions simultànies fallen.** El portal respon 503 a les peticions que li arriben alhora: de cinc, en va rebutjar tres. Com que els assistents fan crides en paral·lel, el servidor les envia d'una en una.
- **La cerca del portal no troba els títols en castellà** («población» dona 0) i exigeix totes les paraules. Per això el servidor es baixa el catàleg sencer (uns 560 conjunts) un cop al dia i hi busca ell mateix: primer els conjunts amb més paraules de la cerca, i al títol millor que a la descripció. Si el catàleg no arriba sencer, no hi busca.
- **Les paraules buides** («del», «per») i les que surten a gairebé tots els títols («Barcelona», «ciutat») no compten a la cerca.
- **Els recursos no arriben ordenats, i la data de creació no és la del període** (un fitxer del 2012 es pot haver pujat el 2026). El servidor els ordena per l'any i el mes del nom, com a `2026_03_Marc_qualitat_aire_BCN.csv`.
- **Els recursos que demanen un token del portal** no es compten com a consultables, i el servidor diu per què.
- **Amb `limit=0` el portal no dona el total.** El servidor en demana una fila i no la torna.
- **Si cap fila compleix la consulta, el portal tampoc dona el total.** El servidor respon zero files amb una nota: els filtres demanen el valor exacte, amb accents i majúscules («Gràcia», no «Gracia»).
- **Un paràmetre repetit fa que el portal respongui 500.** Cada paràmetre s'envia una sola vegada.
- **Els errors 409 diuen quin paràmetre no val** (per exemple, `sort: invalid value "nope desc"`), i es passen a l'assistent perquè corregeixi la crida.
- **Les columnes internes** (`_id` i, en buscar amb `q`, `rank` i `_full_count`) no es tornen.
- **El datastore no suma.** Un total, com la població d'un districte, demana totes les files que compleixen la consulta (n'hi pot haver més de 100 i cal paginar amb `des_de`). Les instruccions demanen a l'assistent que les agafi totes, comparant-les amb `total`, i que digui quantes n'ha sumat.
- **Les dades són de la data del recurs, no de la del conjunt.** Les instruccions demanen a l'assistent que la doni, i que avisi quan un conjunt té la freqüència «serie_interrompuda».

## Reutilització

Open Data BCN dona una llicència a cada conjunt, i `veure_conjunt` la torna tal com la publica el portal.

## Proves

- [src/barcelona.test.ts](../src/barcelona.test.ts): proves sense xarxa, adaptades de les de la PR #265, amb respostes retallades de les reals i sense dades personals.
- Comprovat contra l'API real per stdio el 22 de novembre de 2026: una cerca del padró, els recursos de la població per sexe del 2026 al 2007, els camps d'un recurs, «Gracia» sense accent (zero files i la nota), «Gràcia» (87 files), un ordre no vàlid, un conjunt inexistent i cinc crides alhora.
