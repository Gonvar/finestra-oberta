// El registre de les fonts: un servidor MCP per a cada una. Afegir-ne una és afegir-la aquí (vegeu
// CONTRIBUTING.md). src/servidors.test.ts comprova que cada font compleix les regles del projecte.
import type { McpServer } from '@modelcontextprotocol/server';
import { createBarcelonaServer } from './barcelona.ts';
import type { Fetch } from './comun.ts';
import { createDadesObertesServer } from './dadesobertes.ts';
import { createIdescatServer } from './idescat.ts';
import { createTransportServer } from './transport.ts';

export type Font = {
  /** L'organisme públic que publica les dades, com a la taula de NEUTRALITAT.md. */
  organisme: string;
  /** El domini de la taula de NEUTRALITAT.md d'on surten les dades. */
  domini: string;
  /**
   * La pàgina oficial que en permet la reutilització, d'un domini de la taula de NEUTRALITAT.md. O
   * «per conjunt», si el portal dona una llicència a cada conjunt i el servidor la torna.
   */
  llicencia: string;
};

export type Servidor = {
  /** El nom per executar-lo: `node src/index.ts <nom>`. */
  nom: string;
  /** Els organismes d'on surten les dades. N'hi ha més d'un quan el servidor n'ajunta diversos. */
  fonts: Font[];
  /** La documentació, a `docs/`. */
  docs: string;
  /** Les proves amb dades sintètiques, a `src/`. */
  proves: string;
  crea: (fetchImpl?: Fetch) => McpServer;
};

export const servidors: Servidor[] = [
  {
    nom: 'idescat',
    fonts: [
      {
        organisme: "Institut d'Estadística de Catalunya",
        domini: 'idescat.cat',
        llicencia: 'https://www.idescat.cat/dev/api/#cdu',
      },
    ],
    docs: 'docs/idescat.md',
    proves: 'src/idescat.test.ts',
    crea: createIdescatServer,
  },
  {
    nom: 'dades-obertes',
    fonts: [
      {
        organisme: 'Generalitat de Catalunya (Dades obertes)',
        domini: 'transparenciacatalunya.cat',
        llicencia:
          'https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies',
      },
    ],
    docs: 'docs/dades-obertes.md',
    proves: 'src/dadesobertes.test.ts',
    crea: createDadesObertesServer,
  },
  {
    nom: 'barcelona',
    fonts: [
      {
        organisme: 'Ajuntament de Barcelona (Open Data BCN)',
        domini: 'barcelona.cat',
        llicencia: 'per conjunt',
      },
    ],
    docs: 'docs/barcelona.md',
    proves: 'src/barcelona.test.ts',
    crea: createBarcelonaServer,
  },
  {
    nom: 'transport',
    fonts: [
      { organisme: 'Renfe (Rodalies de Catalunya)', domini: 'renfe.com', llicencia: 'per conjunt' },
      {
        organisme: 'Ferrocarrils de la Generalitat de Catalunya',
        domini: 'fgc.cat',
        llicencia: 'per conjunt',
      },
      {
        organisme: 'Transports Metropolitans de Barcelona',
        domini: 'tmb.cat',
        llicencia: 'https://developer.tmb.cat',
      },
    ],
    docs: 'docs/transport.md',
    proves: 'src/transport.test.ts',
    crea: createTransportServer,
  },
];
