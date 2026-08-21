FROM node:20-alpine AS builder

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat python3 make g++
RUN apk update

WORKDIR /app

# Install pnpm
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

# Build the API
RUN pnpm --filter @trade-copier/api build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# Install pnpm in the runner as well to run prisma scripts if needed
RUN npm i -g pnpm

# Add a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy root workspace configurations for module resolution if necessary
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy built application and required packages
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules

USER nestjs

# Expose port (default 3001)
EXPOSE 3001

ENV PORT 3001

CMD ["node", "apps/api/dist/src/main.js"]
