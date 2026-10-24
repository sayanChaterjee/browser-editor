# syntax=docker/dockerfile:1
# Build context: the repository root (npm workspaces: one lockfile, shared packages/common).
# docker build -f identity-service/Dockerfile .

FROM node:20-alpine AS base
WORKDIR /app
# Lockfile and every workspace manifest first, so dependency layers are cached across source changes
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/common/package.json packages/common/
COPY packages/contracts/package.json packages/contracts/
COPY api-gateway/package.json api-gateway/
COPY identity-service/package.json identity-service/
COPY code-service/package.json code-service/

# Full install of this service + shared packages, then compile them
FROM base AS build
RUN --mount=type=cache,target=/root/.npm npm ci -w @ceditor/common -w @ceditor/contracts -w identity-service --no-audit --no-fund
COPY packages/common/tsconfig.build.json packages/common/
COPY packages/common/src packages/common/src
COPY packages/contracts/tsconfig.build.json packages/contracts/
COPY packages/contracts/src packages/contracts/src
COPY identity-service/tsconfig.json identity-service/
COPY identity-service/src identity-service/src
RUN npm run build -w @ceditor/common && npm run build -w @ceditor/contracts && npm run build -w identity-service

# Production dependencies only (no TypeScript, ESLint, test tools)
FROM base AS prod-deps
RUN --mount=type=cache,target=/root/.npm npm ci -w @ceditor/common -w @ceditor/contracts -w identity-service --omit=dev --no-audit --no-fund \
 && mkdir -p packages/common/node_modules packages/contracts/node_modules identity-service/node_modules

# Runtime: compiled JS + production node_modules, running as the unprivileged node user
FROM node:20-alpine
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/packages/common/node_modules packages/common/node_modules
COPY --from=prod-deps --chown=node:node /app/packages/contracts/node_modules packages/contracts/node_modules
COPY --from=prod-deps --chown=node:node /app/identity-service/node_modules identity-service/node_modules
COPY --chown=node:node packages/common/package.json packages/common/
COPY --from=build --chown=node:node /app/packages/common/dist packages/common/dist
COPY --chown=node:node packages/contracts/package.json packages/contracts/
COPY --from=build --chown=node:node /app/packages/contracts/dist packages/contracts/dist
COPY --chown=node:node identity-service/package.json identity-service/
COPY --from=build --chown=node:node /app/identity-service/dist identity-service/dist
WORKDIR /app/identity-service
USER node
EXPOSE 3001
CMD ["node", "dist/app.js"]
