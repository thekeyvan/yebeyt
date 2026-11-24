# Build from the repo root:  docker build -f apps/web/Dockerfile .
FROM node:24-slim AS base
RUN npm install --global pnpm@12.8.1
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile --filter "@yebeyt/web..."
COPY apps/web apps/web
# The build copies the fonts named in tokens.json from assets/fonts into public/fonts (scripts/copy-fonts.mjs).
COPY packages/tokens packages/tokens
COPY assets/fonts assets/fonts
RUN pnpm --filter @yebeyt/web build

FROM node:24-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
WORKDIR /repo
# Next's standalone output: its own server and only the packages it needs. The static files and public/ are copied beside it.
# Owned by node, so the server (which runs as node) can write .next/cache.
COPY --chown=node:node --from=build /repo/apps/web/.next/standalone ./
COPY --chown=node:node --from=build /repo/apps/web/.next/static apps/web/.next/static
COPY --chown=node:node --from=build /repo/apps/web/public apps/web/public
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
