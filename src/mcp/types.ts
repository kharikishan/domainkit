/** A single content block in an MCP tool response. */
export type McpContent = { type: 'text'; text: string };

/** The standard MCP tool response shape. */
export type McpResult = { content: McpContent[] };
