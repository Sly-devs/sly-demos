/**
 * Demo: drive the Sly × Compass MCP server the way an agent would.
 *
 * Spawns the built MCP server over stdio, authenticated as a real agent
 * token (SLY_API_KEY), lists the tools, and calls one governed_* tool.
 * The exact tool + arguments are passed via env (DEMO_TOOL, DEMO_ARGS).
 * All credentials come from the environment — nothing is hardcoded.
 *
 * Defaults (back-compat with the original one-shot example):
 *   DEMO_TOOL=governed_credit_borrow
 *   DEMO_ARGS='{"agent_id":"3c7812a6-...","owner":"0x897F...","borrow_token":"USDC","amount":"5","chain":"base"}'
 *
 * Run (from repo root):
 *   SLY_API_URL=http://localhost:4000 SLY_API_KEY=<agent token> \
 *   COMPASS_API_KEY_AUTH=<key> \
 *   DEMO_TOOL=governed_earn_deposit DEMO_ARGS='{...}' \
 *   node packages/mcp-compass/demo-agent-client.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, 'dist', 'index.js');

const DEFAULT_CREDIT_AGENT = '3c7812a6-0e45-6149-9e74-d807c33b622e';
const DEFAULT_CREDIT_EOA = '0x897Fb7B2447a750B5d5d0054c848CF2aB42c04e3';

const tool = process.env.DEMO_TOOL || 'governed_credit_borrow';
const args = process.env.DEMO_ARGS
  ? JSON.parse(process.env.DEMO_ARGS)
  : {
      agent_id: DEFAULT_CREDIT_AGENT,
      owner: DEFAULT_CREDIT_EOA,
      borrow_token: 'USDC',
      amount: '5',
      chain: 'base',
    };

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverPath],
  env: {
    ...process.env,
    SLY_API_URL: process.env.SLY_API_URL || 'http://localhost:4000',
    SLY_API_KEY: process.env.SLY_API_KEY,
    COMPASS_API_KEY_AUTH: process.env.COMPASS_API_KEY_AUTH || '',
  },
});

const client = new Client({ name: 'demo-agent', version: '1.0.0' }, { capabilities: {} });
await client.connect(transport);

const { tools } = await client.listTools();
const ownerShort = typeof args.owner === 'string' ? args.owner.slice(0, 8) + '…' : '<n/a>';
console.log(`[agent→MCP] connected — ${tools.length} tools available`);
console.log(`[agent→MCP] calling ${tool} (owner ${ownerShort})\n`);

const res = await client.callTool(
  { name: tool, arguments: args },
  undefined,
  { timeout: 150000 },
);

const text = res.content?.[0]?.text ?? JSON.stringify(res);
console.log('[MCP→agent] result:');
console.log(text);

await client.close();
process.exit(0);
