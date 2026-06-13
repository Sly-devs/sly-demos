import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP tool catalog for the Compass governance wrapper.
 *
 * Read-only (compass_*): shell straight to the Compass CLI, no gate.
 * Governed (governed_*): pass through Sly's policy gate first; the action
 * only proceeds if the PolicyDecision is approve.
 *
 * Covers all four Compass surfaces: earn, credit, perps, tokenized equities.
 * Anything not listed here is not invokable — fail-closed, no passthrough.
 */

declare const tools: Tool[];

export { tools };
