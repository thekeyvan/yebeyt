# Build from the repo root:  docker build -f apps/webapp/Dockerfile .
FROM node:24-slim AS base
RUN npm install --global pnpm@12.8.1
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/webapp/package.json apps/webapp/

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
# The ids of the sign-in providers are public and go into the page when it is built, so Railway's variables of the same names must reach the build.
ARG NEXT_PUBLIC_APPLE_SERVICES_ID
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN pnpm install --frozen-lockfile --filter "@yebeyt/webapp..."
COPY apps/webapp apps/webapp
# The build copies the fonts named in tokens.json from assets/fonts into public/fonts (packages/tokens/copy-fonts.mjs),
# and the colours of tokens.json are read by the app (lib/tokens.ts).
COPY packages/tokens packages/tokens
COPY assets/fonts assets/fonts
# …and the poetry data of the iOS app is copied into public/data (scripts/copy-data.mjs); it is the web app's bundled poetry.
COPY apps/ios/Yebeyt/Resources/Data apps/ios/Yebeyt/Resources/Data
RUN pnpm --filter @yebeyt/webapp build

FROM node:24-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
WORKDIR /repo
# Next's standalone output: its own server and only the packages it needs. The static files and public/ are copied beside it.
# Owned by node, so the server (which runs as node) can write .next/cache.
COPY --chown=node:node --from=build /repo/apps/webapp/.next/standalone ./
COPY --chown=node:node --from=build /repo/apps/webapp/.next/static apps/webapp/.next/static
COPY --chown=node:node --from=build /repo/apps/webapp/public apps/webapp/public
USER node
EXPOSE 8080
CMD ["node", "apps/webapp/server.js"]
