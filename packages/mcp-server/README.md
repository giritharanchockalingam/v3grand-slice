# @v3grand/mcp-server

MCP (Model Context Protocol) server that exposes V3 Grand capabilities as **tools** for AI clients (Cursor, Claude Desktop, or custom agents).

## Tools (current)

- **Market**: `get_macro_indicators`, `get_city_profile`, `get_demand_signals`, `get_construction_costs`, `market_health`

See [docs/MCP_AGENTIC_ARCHITECTURE.md](../../docs/MCP_AGENTIC_ARCHITECTURE.md) for the full tool inventory and agent design.

## Run (stdio)

From repo root:

```bash
pnpm --filter @v3grand/mcp-server start
```

Or from this package:

```bash
pnpm start
```

Uses `.env` from repo root (optional: `RBI_API_KEY`, `FRED_API_KEY`, `DATA_GOV_IN_API_KEY`, `MCP_FALLBACK_MODE`, `MCP_CACHE_TTL`).

## Cursor / Claude Desktop

Add to your MCP config (e.g. Cursor settings → MCP, or Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "v3grand": {
      "command": "pnpm",
      "args": ["--filter", "@v3grand/mcp-server", "start"],
      "cwd": "/absolute/path/to/v3grand-slice-cursor"
    }
  }
}
```

Then the AI can call tools like `get_macro_indicators` and `get_city_profile` during the conversation.

## Dependencies

- `@modelcontextprotocol/sdk` – MCP server and stdio transport
- `@v3grand/mcp` – Market data service
- `zod` – Input schema validation
