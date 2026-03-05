// V3 Grand API - Health Check Routes
// Provides comprehensive health status for load balancers, Kubernetes, and monitoring
// Includes liveness checks, readiness checks, and detailed system metrics

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';

/**
 * Health check response format
 * Follows industry-standard health check patterns for orchestration and monitoring
 */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks?: {
    database?: boolean;
    memory?: boolean;
    disk?: boolean;
  };
  version?: string;
}

interface DetailedHealthCheckResponse extends HealthCheckResponse {
  checks: {
    database: boolean;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      heapThreshold: number;
    };
    disk?: {
      available: boolean;
    };
  };
  dependencies: {
    name: string;
    status: 'up' | 'down';
    latency?: number;
  }[];
  startTime: string;
}

/**
 * Track startup time for uptime calculation
 */
let startTime: Date;

/**
 * Test database connectivity
 * Performs a simple query to verify connection pool health
 */
async function checkDatabase(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Check memory usage and heap pressure
 */
function checkMemory(): {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  heapThreshold: number;
} | null {
  try {
    const memUsage = process.memoryUsage();
    // Convert bytes to MB
    const heapThresholdMB = 512; // 512MB threshold for degraded status
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

    return {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(heapUsedMB),
      heapThreshold: heapThresholdMB,
    };
  } catch (error) {
    console.error('Memory health check failed:', error);
    return null;
  }
}

/**
 * Calculate health status based on all checks
 */
function determineStatus(
  databaseHealthy: boolean,
  memoryHealthy: boolean
): 'healthy' | 'unhealthy' | 'degraded' {
  // System is unhealthy if database is down
  if (!databaseHealthy) {
    return 'unhealthy';
  }

  // System is degraded if memory pressure is high
  if (!memoryHealthy) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * GET /health - Basic liveness probe
 *
 * Used by load balancers and Kubernetes as a liveness probe.
 * This endpoint should return quickly and simply indicate if the server is running.
 * Does NOT check dependencies - that's for /health/ready
 *
 * Response: 200 OK with { status: 'ok' }
 */
export async function registerHealthRoutes(
  fastify: FastifyInstance,
  pool?: Pool
): Promise<void> {
  // Record startup time on first registration
  if (!startTime) {
    startTime = new Date();
  }

  /**
   * Liveness Probe: Is the service running?
   * Fast, minimal check suitable for frequent polling by orchestrators
   */
  fastify.get<{ Reply: HealthCheckResponse }>(
    '/health',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const uptime = Date.now() - startTime.getTime();

      const response: HealthCheckResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime,
        version: process.env.API_VERSION || '1.0.0',
      };

      reply.code(200).send(response);
    }
  );

  /**
   * Readiness Probe: Is the service ready to accept requests?
   * Checks dependencies like database, cache, etc.
   * Used during startup and rolling deployments to determine when traffic can be sent
   */
  fastify.get<{ Reply: DetailedHealthCheckResponse }>(
    '/health/ready',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const uptime = Date.now() - startTime.getTime();

      // Check dependencies
      const databaseHealthy = pool ? await checkDatabase(pool) : true;
      const memoryStatus = checkMemory();
      const memoryHealthy = memoryStatus ? memoryStatus.heapUsed < memoryStatus.heapThreshold : true;

      // Determine overall status
      const status = determineStatus(databaseHealthy, memoryHealthy);

      // Prepare response
      const response: DetailedHealthCheckResponse = {
        status,
        timestamp: new Date().toISOString(),
        uptime,
        startTime: startTime.toISOString(),
        version: process.env.API_VERSION || '1.0.0',
        checks: {
          database: databaseHealthy,
          memory: memoryStatus || {
            rss: 0,
            heapTotal: 0,
            heapUsed: 0,
            heapThreshold: 512,
          },
        },
        dependencies: [
          {
            name: 'database',
            status: databaseHealthy ? 'up' : 'down',
          },
          {
            name: 'memory',
            status: memoryHealthy ? 'up' : 'down',
          },
        ],
      };

      // Return appropriate HTTP status code
      const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 503 : 503;
      reply.code(httpStatus).send(response);
    }
  );

  /**
   * Detailed Health Metrics (internal use)
   * Returns verbose information for monitoring and debugging
   * Requires authentication in production (not implemented here)
   */
  fastify.get<{ Reply: DetailedHealthCheckResponse }>(
    '/health/metrics',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const uptime = Date.now() - startTime.getTime();

      // Comprehensive checks
      const databaseHealthy = pool ? await checkDatabase(pool) : true;
      const memoryStatus = checkMemory();
      const memoryHealthy = memoryStatus ? memoryStatus.heapUsed < memoryStatus.heapThreshold : true;

      const status = determineStatus(databaseHealthy, memoryHealthy);

      const response: DetailedHealthCheckResponse = {
        status,
        timestamp: new Date().toISOString(),
        uptime,
        startTime: startTime.toISOString(),
        version: process.env.API_VERSION || '1.0.0',
        checks: {
          database: databaseHealthy,
          memory: memoryStatus || {
            rss: 0,
            heapTotal: 0,
            heapUsed: 0,
            heapThreshold: 512,
          },
        },
        dependencies: [
          {
            name: 'database',
            status: databaseHealthy ? 'up' : 'down',
          },
          {
            name: 'memory',
            status: memoryHealthy ? 'up' : 'down',
          },
        ],
      };

      const httpStatus = status === 'healthy' ? 200 : 503;
      reply.code(httpStatus).send(response);
    }
  );

  fastify.log.info('Health check routes registered');
}
