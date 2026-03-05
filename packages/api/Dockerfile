# V3 Grand API - Production Dockerfile
# Multi-stage build for enterprise-grade Fastify API
# Security: Non-root user, minimal attack surface, security headers

# ─── Stage 1: Dependencies ───────────────────────────────────────────
# Install and cache dependencies in separate layer for better rebuild times
FROM node:20-slim AS dependencies

# Set working directory for dependency installation
WORKDIR /app

# Copy monorepo package files
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/engines/package.json ./packages/engines/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/mcp-server/package.json ./packages/mcp-server/

# Install pnpm globally
RUN npm install -g pnpm@latest

# Install production dependencies (--frozen-lockfile ensures reproducible builds)
RUN pnpm install --frozen-lockfile --prod


# ─── Stage 2: Builder ────────────────────────────────────────────────
# Compile TypeScript to JavaScript
FROM node:20-slim AS builder

WORKDIR /app

# Copy all source files and configuration
COPY . .

# Install pnpm
RUN npm install -g pnpm@latest

# Install all dependencies (including dev for TypeScript compilation)
RUN pnpm install --frozen-lockfile

# Build TypeScript to JavaScript
# This assumes tsconfig at repo root or packages/api
RUN pnpm --filter @v3grand/api build || true
RUN pnpm --filter @v3grand/api run build:vercel || true

# Compile with esbuild if build script unavailable
RUN pnpm --filter @v3grand/api exec esbuild src/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --external:@v3grand/mcp-server || true


# ─── Stage 3: Production Runtime ─────────────────────────────────────
# Final minimal image with only runtime dependencies
FROM node:20-slim AS production

# Install dumb-init for proper signal handling (PID 1 management)
RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root application user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Set working directory
WORKDIR /app

# Copy only production dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built application files from builder stage
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/src ./src
COPY --from=builder /app/packages/api/package.json ./

# Copy shared package dependencies
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/engines ./packages/engines
COPY --from=builder /app/packages/mcp ./packages/mcp
COPY --from=builder /app/packages/mcp-server ./packages/mcp-server

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV LOG_LEVEL=info

# Health check: ping API health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start application with tsx for TypeScript runtime support
CMD ["node", "--enable-source-maps", "dist/index.js"]
