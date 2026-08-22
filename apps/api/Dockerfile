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

# Dynamically find the generated Alpine query engine deep inside pnpm's virtual store
# and copy it to a known export directory.
RUN mkdir -p /app/exported-engines && find /app/node_modules -type f -name "*query*engine*linux*musl*" -exec cp {} /app/exported-engines/ \;

# Build the API
RUN pnpm --filter @trade-copier/api build

# Deploy only production dependencies to a pruned directory
RUN pnpm --filter @trade-copier/api --prod deploy pruned

# pnpm deploy runs a fresh prod install which skips prisma generate postinstall,
# so the generated .prisma/client code is missing from pruned/node_modules.
# Copy it from the builder's pnpm virtual store into the pruned output.
RUN find /app/node_modules/.pnpm -name ".prisma" -type d -exec sh -c \
      'src="$1"; rel="${src#/app/node_modules/}"; dest="/app/pruned/node_modules/$rel"; mkdir -p "$dest"; cp -r "$src/." "$dest/"' \
      _ {} \;

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# Add a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Install openssl (required by Prisma on Alpine)
RUN apk add --no-cache openssl openssl-dev

# Create data directory for HotDispatchService journals
RUN mkdir -p /app/data && chown -R nestjs:nodejs /app/data

# Copy the standalone production-ready files (including the restored .prisma/client)
COPY --from=builder --chown=nestjs:nodejs /app/pruned ./

# Copy the exported Prisma query engine into /tmp/prisma-engines fallback directory
COPY --from=builder --chown=nestjs:nodejs /app/exported-engines/ /tmp/prisma-engines/

# Copy the schema so Prisma can find it for any runtime introspection
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/prisma/schema.prisma /app/packages/database/prisma/schema.prisma

USER nestjs

# Expose port (default 3001)
EXPOSE 3001

ENV PORT 3001

CMD ["node", "dist/src/main.js"]
