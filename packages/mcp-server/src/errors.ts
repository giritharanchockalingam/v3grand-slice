// ─── MCP Tool Result & Error Helpers ─────────────────────────────────
// Aligns with Aurora-style tool result shape: content[] with text/data, isError flag.

export enum MCPErrorCode {
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  DEAL_NOT_FOUND = 'DEAL_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  ENGINE_ERROR = 'ENGINE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class MCPError extends Error {
  code: MCPErrorCode;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: MCPErrorCode = MCPErrorCode.INTERNAL_ERROR,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
  }
}

/** Tool result content item: text and/or structured data (Aurora-style). */
export interface MCPToolContent {
  type: 'text' | 'data';
  text?: string;
  data?: unknown;
}

/** Standard tool result for MCP tools/list + tools/call. */
export interface MCPToolResult {
  content: MCPToolContent[];
  isError?: boolean;
}

/** Success: optional text + optional structured data. */
export function toolResultSuccess(text: string, data?: unknown): MCPToolResult {
  const content: MCPToolContent[] = [{ type: 'text', text }];
  if (data !== undefined) {
    content.push({ type: 'data', data });
  }
  return { content };
}

/** Error: single text content and isError true. */
export function toolResultError(message: string, code?: MCPErrorCode, details?: Record<string, unknown>): MCPToolResult {
  const text = code ? `[${code}] ${message}` : message;
  const content: MCPToolContent[] = [{ type: 'text', text }];
  if (details && Object.keys(details).length > 0) {
    content.push({ type: 'data', data: { code: code ?? MCPErrorCode.INTERNAL_ERROR, details } });
  }
  return { content, isError: true };
}

/** Convert MCPToolResult to the handler return shape: content array for SDK. */
export function toHandlerContent(result: MCPToolResult): Array<{ type: 'text'; text: string }> {
  const out: Array<{ type: 'text'; text: string }> = [];
  for (const c of result.content) {
    if (c.type === 'text' && c.text) out.push({ type: 'text', text: c.text });
    if (c.type === 'data' && c.data !== undefined) {
      out.push({ type: 'text', text: JSON.stringify(c.data, null, 2) });
    }
  }
  if (out.length === 0) out.push({ type: 'text', text: result.isError ? 'Error' : 'OK' });
  return out;
}
