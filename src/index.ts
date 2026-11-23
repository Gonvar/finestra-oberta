import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { servidors } from './servidors.ts';

const servidor = servidors.find((s) => s.nom === process.argv[2]);

if (!servidor) {
  console.error(`Indica el servidor: node src/index.ts <${servidors.map((s) => s.nom).join('|')}>`);
  process.exit(1);
}
serveStdio(() => servidor.crea());
