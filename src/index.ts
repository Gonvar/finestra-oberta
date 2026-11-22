import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createIdescatServer } from './idescat.ts';

serveStdio(() => createIdescatServer());
