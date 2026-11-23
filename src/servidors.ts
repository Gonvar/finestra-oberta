// El registre de les fonts: un servidor MCP per a cada una. Afegir-ne una és afegir-la aquí (vegeu
// CONTRIBUTING.md). src/servidors.test.ts comprova que cada font compleix les regles del projecte.
import type { McpServer } from '@modelcontextprotocol/server';
import { createBarcelonaServer } from './barcelona.ts';
import type { Fetch } from './comun.ts';
import { createDadesObertesServer } from './dadesobertes.ts';
import { createIdescatServer } from './idescat.ts';

export type Servidor = {
  /** El nom per executar-lo: `node src/index.ts <nom>`. */
  nom: string;
  /** L'organisme públic que publica les dades, com a la taula de NEUTRALITAT.md. */
  organisme: string;
  /** El domini de la taula de NEUTRALITAT.md d'on surten les dades. */
  domini: string;
  /**
   * La pàgina oficial que en permet la reutilització, d'un domini de la taula de NEUTRALITAT.md. O
   * «per conjunt», si el portal dona una llicència a cada conjunt i el servidor la torna.
   */
  llicencia: string;
  /** La documentació, a `docs/`. */
  docs: string;
  /** Les proves amb dades sintètiques, a `src/`. */
  proves: string;
  crea: (fetchImpl?: Fetch) => McpServer;
};

export const servidors: Servidor[] = [
  {
    nom: 'idescat',
    organisme: "Institut d'Estadística de Catalunya",
    domini: 'idescat.cat',
    llicencia: 'https://www.idescat.cat/dev/api/#cdu',
    docs: 'docs/idescat.md',
    proves: 'src/idescat.test.ts',
    crea: createIdescatServer,
  },
  {
    nom: 'dades-obertes',
    organisme: 'Generalitat de Catalunya (Dades obertes)',
    domini: 'transparenciacatalunya.cat',
    llicencia:
      'https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/',
    docs: 'docs/dades-obertes.md',
    proves: 'src/dadesobertes.test.ts',
    crea: createDadesObertesServer,
  },
  {
    nom: 'barcelona',
    organisme: 'Ajuntament de Barcelona (Open Data BCN)',
    domini: 'barcelona.cat',
    llicencia: 'per conjunt',
    docs: 'docs/barcelona.md',
    proves: 'src/barcelona.test.ts',
    crea: createBarcelonaServer,
  },
];
