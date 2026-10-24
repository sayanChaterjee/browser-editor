# syntax=docker/dockerfile:1
# Build context: the repository root (npm workspaces: one lockfile, shared packages/common).
# docker build -f auth-service/Dockerfile .

FROM node:20-alpine AS base
WORKDIR /app
# Lockfile and every workspace manifest first, so dependency layers are cached across source changes
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/common/package.json packages/common/
COPY api-gateway/package.json api-gateway/
COPY auth-service/package.json auth-service/
COPY user-service/package.json user-service/
COPY code-service/package.json code-service/

# Full install of this service + common, then compile both
FROM base AS build
RUN --mount=type=cache,target=/root/.npm npm ci -w @ceditor/common -w auth-service --no-audit --no-fund
COPY packages/common/tsconfig.build.json packages/common/
COPY packages/common/src packages/common/src
COPY auth-service/tsconfig.json auth-service/
COPY auth-service/src auth-service/src
RUN npm run build -w @ceditor/common && npm run build -w auth-service

# Production dependencies only (no TypeScript, ESLint, test tools)
FROM base AS prod-deps
RUN --mount=type=cache,target=/root/.npm npm ci -w @ceditor/common -w auth-service --omit=dev --no-audit --no-fund \
 && mkdir -p packages/common/node_modules auth-service/node_modules

# Runtime: compiled JS + production node_modules, running as the unprivileged node user
FROM node:20-alpine
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/packages/common/node_modules packages/common/node_modules
COPY --from=prod-deps --chown=node:node /app/auth-service/node_modules auth-service/node_modules
COPY --chown=node:node packages/common/package.json packages/common/
COPY --from=build --chown=node:node /app/packages/common/dist packages/common/dist
COPY --chown=node:node auth-service/package.json auth-service/
COPY --from=build --chown=node:node /app/auth-service/dist auth-service/dist
WORKDIR /app/auth-service
USER node
EXPOSE 3001
CMD ["node", "dist/app.js"]
