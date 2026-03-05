# V3 Grand UI - Production Dockerfile
# Multi-stage Next.js build for enterprise-grade React application
# Security: Non-root user, minimal runtime image, security best practices

# ─── Stage 1: Dependencies ───────────────────────────────────────────
# Install and cache node modules for better Docker layer caching
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy monorepo package files
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json ./packages/ui/
COPY packages/core/package.json ./packages/core/

# Install pnpm
RUN npm install -g pnpm@latest

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod


# ─── Stage 2: Builder ────────────────────────────────────────────────
# Build Next.js application with TypeScript compilation and optimization
FROM node:20-alpine AS builder

WORKDIR /app

# Copy entire project structure
COPY . .

# Install pnpm
RUN npm install -g pnpm@latest

# Install all dependencies (including dev for Next.js build)
RUN pnpm install --frozen-lockfile

# Build Next.js application with standalone mode enabled
# Standalone mode reduces final image size by 60%+
RUN pnpm --filter @v3grand/ui run build

# Verify build output exists
RUN test -d /app/packages/ui/.next || exit 1


# ─── Stage 3: Production Runtime ─────────────────────────────────────
# Minimal runtime image with only necessary files
FROM node:20-alpine AS runner

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root application user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

WORKDIR /app

# Copy .next/standalone from builder (includes node_modules equivalent)
COPY --from=builder /app/packages/ui/.next/standalone ./

# Copy public assets
COPY --from=builder /app/packages/ui/public ./packages/ui/public

# Copy .next/static for client-side assets
COPY --from=builder /app/packages/ui/.next/static ./packages/ui/.next/static

# Create required directories
RUN mkdir -p /app/packages/ui

# Set ownership to nextjs user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose UI port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Health check: verify Next.js server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start Next.js application (uses standalone server)
# The standalone build includes Node.js server without next CLI dependency
CMD ["node", "packages/ui/server.js"]
