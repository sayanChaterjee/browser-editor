# syntax=docker/dockerfile:1

# Shared base: lockfile first so dependency layers are cached across source changes.
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# Full install + TypeScript compile.
FROM base AS build
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production dependencies only (no TypeScript, ESLint, Jest, ts-node...).
FROM base AS prod-deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

# Runtime: compiled JS + production node_modules, running as the unprivileged node user.
FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3003
CMD ["node", "dist/app.js"]
