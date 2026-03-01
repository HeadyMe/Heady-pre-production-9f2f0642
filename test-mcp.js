import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
const t = new StdioClientTransport({ command: 'node', args: ['/home/headyme/Heady/src/mcp/heady-mcp-server.js'] });
const c = new Client({ name: 'test', version: '1.0' }, { capabilities: {} });
async function run() {
  await c.connect(t);
  const res = await c.callTool({ name: 'heady_health', arguments: {} });
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}
run().catch(console.error);
