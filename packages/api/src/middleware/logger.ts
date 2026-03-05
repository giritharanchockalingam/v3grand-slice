// V3 Grand API - Structured Logging Middleware
// Provides request/response logging with correlation IDs, timing, and error serialization
// Follows JSON structured logging best practices for observability and debugging

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

/**
 * Structured Log Entry
 * Standard format for all logged events to enable parsing and analysis
 */
interface LogEntry {
  // Request tracking
  requestId: string;
  correlationId: string;

  // Request details
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;

  // Response details
  statusCode?: number;
  responseSize?: number;

  // Timing
  duration: number;

  // Error tracking (if applicable)
  error?: {
    message: string;
    code?: string;
    stack?: string;
    details?: Record<string, unknown>;
  };

  // Additional context
  userId?: string;
  userAgent?: string;
  remoteIp?: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
}

/**
 * Generate a unique request ID for correlation and tracking
 * Enables following a request through all services
 */
function generateRequestId(): string {
  return randomUUID();
}

/**
 * Extract or generate correlation ID from request headers
 * Allows tracing requests across distributed system
 *
 * Checks for common correlation ID header names:
 * - x-correlation-id (custom standard)
 * - x-request-id (AWS)
 * - x-trace-id (distributed tracing)
 */
function getOrCreateCorrelationId(request: FastifyRequest): string {
  const headers = request.headers;

  // Check for existing correlation ID
  const correlationId =
    (headers['x-correlation-id'] as string) ||
    (headers['x-request-id'] as string) ||
    (headers['x-trace-id'] as string) ||
    generateRequestId();

  return correlationId;
}

/**
 * Extract user IP address from request
 * Handles X-Forwarded-For and proxy scenarios
 */
function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.ip;
  return ip || 'unknown';
}

/**
 * Serialize error for JSON logging
 * Extracts message, code, and stack trace safely
 */
function serializeError(error: unknown): LogEntry['error'] {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code || undefined,
      stack: error.stack,
      details: Object.getOwnPropertyNames(error).reduce(
        (acc, key) => {
          const value = (error as any)[key];
          // Only include serializable properties
          if (typeof value !== 'function') {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, unknown>
      ),
    };
  }

  return {
    message: String(error),
  };
}

/**
 * Safe body serialization
 * Excludes sensitive fields like passwords and tokens
 */
function serializeBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key'];
  const obj = body as Record<string, unknown>;

  // Create shallow copy with sensitive fields redacted
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    safe[key] = sensitiveFields.some((field) =>
      key.toLowerCase().includes(field.toLowerCase())
    )
      ? '[REDACTED]'
      : value;
  }

  return safe;
}

/**
 * Format timestamp in ISO 8601 format with milliseconds
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Create structured log entry for request/response
 */
function createLogEntry(
  requestId: string,
  correlationId: string,
  request: FastifyRequest,
  statusCode?: number,
  duration?: number,
  error?: unknown
): LogEntry {
  return {
    requestId,
    correlationId,
    method: request.method,
    path: request.url,
    query: Object.keys(request.query).length > 0 ? request.query : undefined,
    body: serializeBody(request.body),
    statusCode,
    responseSize: undefined,
    duration: duration || 0,
    error: serializeError(error),
    userId: (request as any).userId,
    userAgent: request.headers['user-agent'],
    remoteIp: getClientIp(request),
    timestamp: getCurrentTimestamp(),
    level: error ? 'error' : statusCode && statusCode >= 500 ? 'error' : 'info',
  };
}

/**
 * Output log entry as JSON
 * Handles both console output and structured logging
 */
function outputLog(entry: LogEntry): void {
  // Determine output stream based on log level
  const isError = entry.level === 'error';
  const output = isError ? console.error : console.log;

  // Output as JSON for easy parsing and aggregation
  output(JSON.stringify(entry));
}

/**
 * Register logger middleware with Fastify instance
 * Hooks into request lifecycle to track timing and errors
 */
export async function registerLoggerMiddleware(fastify: FastifyInstance): Promise<void> {
  // Store request metadata on the request object
  declare global {
    namespace FastifyRequest {
      interface FastifyRequest {
        requestId?: string;
        correlationId?: string;
        startTime?: number;
      }
    }
  }

  /**
   * Hook: Before request handler
   * Generates IDs and records start time
   */
  fastify.addHook('onRequest', async (request, reply) => {
    request.requestId = generateRequestId();
    request.correlationId = getOrCreateCorrelationId(request);
    request.startTime = Date.now();

    // Propagate correlation ID to response headers
    reply.header('X-Request-ID', request.requestId);
    reply.header('X-Correlation-ID', request.correlationId);
  });

  /**
   * Hook: Before response sent
   * Logs completed request with status and timing
   */
  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.startTime || !request.requestId || !request.correlationId) {
      return;
    }

    const duration = Date.now() - request.startTime;
    const statusCode = reply.statusCode;

    // Create and output log entry
    const logEntry = createLogEntry(
      request.requestId,
      request.correlationId,
      request,
      statusCode,
      duration
    );

    outputLog(logEntry);
  });

  /**
   * Hook: Error handler
   * Logs errors with full context and stack trace
   */
  fastify.setErrorHandler(async (error, request, reply) => {
    const requestId = request.requestId || generateRequestId();
    const correlationId = request.correlationId || getOrCreateCorrelationId(request);
    const duration = request.startTime ? Date.now() - request.startTime : 0;

    // Determine status code from error or use 500
    const statusCode = (error as any).statusCode || 500;

    // Create error log entry
    const logEntry = createLogEntry(
      requestId,
      correlationId,
      request,
      statusCode,
      duration,
      error
    );

    outputLog(logEntry);

    // Send error response to client
    reply.code(statusCode).send({
      error: {
        requestId,
        correlationId,
        message: (error as any).message || 'Internal Server Error',
        code: (error as any).code || 'INTERNAL_ERROR',
      },
    });
  });

  // Log middleware registration
  fastify.log.info({
    message: 'Structured logger middleware registered',
    level: 'info',
    timestamp: getCurrentTimestamp(),
  });
}

/**
 * Utility: Create a child logger for service methods
 * Maintains correlation context across service calls
 */
export function createContextualLogger(correlationId: string, userId?: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) => {
      outputLog({
        requestId: generateRequestId(),
        correlationId,
        method: 'SERVICE',
        path: 'internal',
        duration: 0,
        userId,
        timestamp: getCurrentTimestamp(),
        level: 'info',
      } as any);
    },

    error: (message: string, error?: Error, data?: Record<string, unknown>) => {
      outputLog({
        requestId: generateRequestId(),
        correlationId,
        method: 'SERVICE',
        path: 'internal',
        error: serializeError(error),
        duration: 0,
        userId,
        timestamp: getCurrentTimestamp(),
        level: 'error',
      } as any);
    },

    debug: (message: string, data?: Record<string, unknown>) => {
      // Only output in development
      if (process.env.NODE_ENV === 'development') {
        outputLog({
          requestId: generateRequestId(),
          correlationId,
          method: 'SERVICE',
          path: 'internal',
          duration: 0,
          userId,
          timestamp: getCurrentTimestamp(),
          level: 'debug',
        } as any);
      }
    },
  };
}
