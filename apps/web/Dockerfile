FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++
RUN apk update

WORKDIR /app

RUN npm i -g pnpm

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/

# Copy the rest of the application code
COPY . .

# Install dependencies and generate prisma client
RUN pnpm install
RUN pnpm run db:generate

# Set build-time env vars (needed for some Next configs if any)
ENV NEXT_TELEMETRY_DISABLED 1

# Build the Web app
# Next.js standalone mode MUST be enabled in next.config.ts!
RUN pnpm --filter @trade-copier/web build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output
COPY --from=builder /app/apps/web/public ./apps/web/public

# Set permissions for nextjs user
RUN mkdir -p /app/apps/web/.next && chown nextjs:nodejs /app/apps/web/.next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000

# server.js is created by next build from the standalone output
CMD ["node", "apps/web/server.js"]
