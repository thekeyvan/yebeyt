# Build from the repo root:  docker build -f apps/server/Dockerfile .
FROM node:24-slim AS base
RUN npm install --global pnpm@12.8.1
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/api/package.json packages/api/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@yebeyt/server..."
COPY apps/server apps/server
RUN pnpm --filter @yebeyt/server build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@yebeyt/server..."

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /repo/apps/server
COPY --from=prod-deps /repo/node_modules /repo/node_modules
COPY --from=prod-deps /repo/apps/server/node_modules ./node_modules
COPY --from=build /repo/apps/server/dist ./dist
COPY --from=build /repo/apps/server/drizzle ./drizzle
# The game deck, the poets and books for its questions, and the pinned ganjoor-data commit: the app's own data files (see src/gameData.ts).
COPY apps/ios/Yebeyt/Resources/Data/games.json apps/ios/Yebeyt/Resources/Data/library.json apps/ios/Yebeyt/Resources/Data/poets.json ./data/
COPY apps/server/package.json ./
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
