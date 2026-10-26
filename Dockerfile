FROM node:24-bookworm-slim AS build
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
WORKDIR /app
RUN npm install --global pnpm@10.33.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json packages/sdk/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY src src
COPY public public
COPY packages/sdk packages/sdk
COPY scripts/build-server.mjs scripts/build-desktop.mjs scripts/offline-plugin.ts scripts/
COPY index.html vite.config.ts tsconfig.json ./
RUN pnpm build
RUN pnpm prune --prod --ignore-scripts

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4174 PARABOLIC_DATABASE=/data/workspace.sqlite PARABOLIC_STATIC_DIR=/app/dist
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-server ./dist-server
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 4174
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:4174/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/index.mjs"]
