// Els vots de cada candidatura a les últimes eleccions municipals, per municipi, de la Secretaria de
// Governs Locals a Dades obertes de Catalunya. No és un servidor MCP: src/dades.ts ho desa a la
// branca `dades`. Totes les candidatures tenen els mateixos camps i van en l'ordre dels vots.
import {
  codiMunicipi,
  dia,
  filesSocrata,
  metadades,
  numero,
  obligatori,
  SOCRATA,
  SourceError,
  type Fetch,
} from './comun.ts';

export const VOTS_MUNICIPALS = 'vq27-2ky2';

const files = (fetchImpl: Fetch, params: Record<string, string>) =>
  filesSocrata(fetchImpl, VOTS_MUNICIPALS, params);

/**
 * `codis` són els municipis de Municat: cada un ha de tenir resultats, i no n'hi pot haver de cap
 * altre, o la fitxa d'algun municipi diria que no hi va haver eleccions.
 */
export async function construirEleccionsMunicipals(fetchImpl: Fetch, codis: Set<string>) {
  const meta = await metadades(fetchImpl, VOTS_MUNICIPALS);
  const anys = (await files(fetchImpl, { $select: 'distinct any_eleccio' })).map((f) =>
    numero(obligatori(f, 'any_eleccio', VOTS_MUNICIPALS), 'L’any de l’elecció'),
  );
  if (anys.length === 0) throw new SourceError(`El conjunt ${VOTS_MUNICIPALS} és buit.`);
  const any = Math.max(...anys);
  const vots = await files(fetchImpl, {
    $select: 'codi_ens, municipi, sigles_candidatura, vots, vots_1, regidors',
    $where: `any_eleccio = '${any}'`,
    $order: 'codi_ens',
  });

  const municipis = new Map<
    string,
    {
      nom: string;
      candidatures: { sigles: string; vots: number; percentatge: number; regidors: number }[];
    }
  >();
  for (const fila of vots) {
    const codi = codiMunicipi(obligatori(fila, 'codi_ens', VOTS_MUNICIPALS));
    const nom = obligatori(fila, 'municipi', VOTS_MUNICIPALS);
    const municipi = municipis.get(codi) ?? { nom, candidatures: [] };
    if (municipi.nom !== nom)
      throw new SourceError(`El codi ${codi} correspon a ${municipi.nom} i a ${nom}.`);
    const sigles = obligatori(fila, 'sigles_candidatura', VOTS_MUNICIPALS);
    if (municipi.candidatures.some((c) => c.sigles === sigles))
      throw new SourceError(`${nom} té dues vegades la candidatura ${sigles}.`);
    municipi.candidatures.push({
      sigles,
      vots: numero(obligatori(fila, 'vots', VOTS_MUNICIPALS), 'Els vots'),
      // La font dona el percentatge en centèsimes («2268» és el 22,68 %).
      percentatge: numero(obligatori(fila, 'vots_1', VOTS_MUNICIPALS), 'El percentatge') / 100,
      regidors: numero(obligatori(fila, 'regidors', VOTS_MUNICIPALS), 'Els regidors'),
    });
    municipis.set(codi, municipi);
  }

  const falten = [...codis].filter((c) => !municipis.has(c));
  const sobren = [...municipis.keys()].filter((c) => !codis.has(c));
  if (falten.length > 0 || sobren.length > 0)
    throw new SourceError(
      `Els municipis dels resultats i els de Municat no coincideixen (falten ${falten.join(', ') || 'cap'}; sobren ${sobren.join(', ') || 'cap'}).`,
    );

  return {
    font: `Dades obertes de Catalunya: ${meta.name} (${meta.attribution})`,
    url: `${SOCRATA}/d/${VOTS_MUNICIPALS}`,
    data_dades: dia(meta),
    any,
    nota: 'Els vots i els regidors de cada candidatura a les últimes eleccions municipals, tal com els dona la font, de més a menys vots. El percentatge és el que calcula la font. Les sigles són les de la font, que pot escriure el mateix partit de maneres diferents en municipis diferents.',
    municipis: [...municipis]
      .map(([codi, { nom, candidatures }]) => ({
        codi,
        nom,
        // L'ordre de les files de la font no ha de decidir qui surt primer quan dues candidatures empaten.
        candidatures: candidatures.sort(
          (a, b) => b.vots - a.vots || a.sigles.localeCompare(b.sigles, 'ca'),
        ),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'ca')),
  };
}
