#!/usr/bin/env node
import {
  createCompassMcpServer
} from "./chunk-KQZYEGTD.js";
import {
  tools
} from "./chunk-CSELGNUX.js";

// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
var SLY_API_KEY = process.env.SLY_API_KEY;
if (!SLY_API_KEY) {
  console.error("Error: SLY_API_KEY is required (tenant API key pk_* or agent token).");
  process.exit(1);
}
if (!process.env.COMPASS_API_KEY_AUTH) {
  console.error("Warning: COMPASS_API_KEY_AUTH is not set \u2014 the compass binary will fail to authenticate.");
}
var ctx = {
  apiUrl: process.env.SLY_API_URL || "https://api.getsly.ai",
  apiKey: SLY_API_KEY,
  defaultChain: process.env.COMPASS_CHAIN || "base"
};
async function main() {
  const server = createCompassMcpServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sly \xD7 Compass MCP server running on stdio");
  console.error(`Sly API: ${ctx.apiUrl} | default chain: ${ctx.defaultChain}`);
}
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
export {
  createCompassMcpServer,
  tools
};
