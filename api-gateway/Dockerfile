# syntax=docker/dockerfile:1
# Build context: the repository root (npm workspaces: one lockfile, shared packages/common).
# docker build -f api-gateway/Dockerfile .

FROM node:20-alpine AS base
WORKDIR /app
# Lockfile and every workspace manifest first, so dependency layers are cached across source changes
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/common/package.json packages/common/
COPY packages/contracts/package.json packages/contracts/
COPY api-gateway/package.json api-gateway/
COPY identity-service/package.json identity-service/
COPY code-service/package.json code-service/
COPY contest-service/package.json contest-service/

# Full install of this service + common, then compile both
FROM base AS build
RUN --mount=type=cache,target=/root/.npm npm ci -w @ceditor/common -w api-gateway --no-audit --no-fund
COPY packages/common/tsconfig.build.json packages/common/
COPY packages/common/src packages/common/src
COPY api-gateway/tsconfig.json api-gateway/
COPY api-gateway/src api-gateway/src
RUN npm run build -w @ceditor/common && npm run build -w api-gateway

# Production dependencies only (no TypeScript, ESLint, test tools)
FROM base AS prod-deps
RUN --mount=type=cache,target=/root/.npm npm ci -w @ceditor/common -w api-gateway --omit=dev --no-audit --no-fund \
 && mkdir -p packages/common/node_modules api-gateway/node_modules

# Runtime: compiled JS + production node_modules, running as the unprivileged node user
FROM node:20-alpine
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/packages/common/node_modules packages/common/node_modules
COPY --from=prod-deps --chown=node:node /app/api-gateway/node_modules api-gateway/node_modules
COPY --chown=node:node packages/common/package.json packages/common/
COPY --from=build --chown=node:node /app/packages/common/dist packages/common/dist
COPY --chown=node:node api-gateway/package.json api-gateway/
COPY --from=build --chown=node:node /app/api-gateway/dist api-gateway/dist
WORKDIR /app/api-gateway
USER node
EXPOSE 3000
CMD ["node", "dist/app.js"]
