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

# Deploy only production dependencies to a pruned directory
RUN pnpm --filter @trade-copier/api --prod deploy pruned

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# Install pnpm in the runner as well to run prisma scripts if needed
RUN npm i -g pnpm

# Add a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Install openssl (required by Prisma on Alpine)
RUN apk add --no-cache openssl openssl-dev

# Create data directory for HotDispatchService journals
RUN mkdir -p /app/data && chown -R nestjs:nodejs /app/data

# Copy the standalone production-ready files
COPY --from=builder --chown=nestjs:nodejs /app/pruned ./

# Generate the Prisma engines specifically for the Alpine runner environment
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/schema.prisma ./schema.prisma
RUN npx prisma generate --schema=./schema.prisma

USER nestjs

# Expose port (default 3001)
EXPOSE 3001

ENV PORT 3001

CMD ["node", "apps/api/dist/src/main.js"]
