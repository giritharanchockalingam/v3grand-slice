// Ambient declaration for @modelcontextprotocol/sdk when types are not resolved (e.g. ESM export shape).
declare module '@modelcontextprotocol/sdk' {
  export const McpServer: new (options: { name: string; version: string }) => {
    registerTool(name: string, schema: unknown, handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>): void;
    connect(transport: unknown): Promise<void>;
  };
  export const StdioServerTransport: new () => unknown;
  export const Server: typeof McpServer;
}
