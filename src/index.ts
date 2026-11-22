import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createDadesObertesServer } from './dadesobertes.ts';
import { createIdescatServer } from './idescat.ts';

const servers = { idescat: createIdescatServer, 'dades-obertes': createDadesObertesServer };
const name = process.argv[2];

if (!(name && name in servers)) {
  console.error(`Indica el servidor: node src/index.ts <${Object.keys(servers).join('|')}>`);
  process.exit(1);
}
const create = servers[name as keyof typeof servers];
serveStdio(() => create());
