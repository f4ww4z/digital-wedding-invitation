# syntax=docker/dockerfile:1.7
# Multi-stage build for both services. Targets: `api`, `web`.

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine

# ---------- deps: full workspace install (native modules compiled here) ----------
FROM ${NODE_IMAGE} AS deps
RUN apk add --no-cache python3 make g++ \
 && npm install -g pnpm@10.23.0 node-gyp@12
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter '!@sakinah/e2e'

# ---------- build ----------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @sakinah/api build \
 && pnpm --filter @sakinah/web build \
 && pnpm --filter @sakinah/api deploy --prod --legacy /out/api \
 && cp -r apps/api/dist /out/api/dist

# ---------- api runtime ----------
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production \
    API_PORT=3000 \
    DATA_DIR=/data \
    UPLOAD_DIR=/uploads \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
# Remove package managers from the runtime image; they are not needed to run.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* \
 && mkdir -p /data /uploads \
 && chown node:node /data /uploads
COPY --from=build --chown=root:root /out/api/node_modules ./node_modules
COPY --from=build --chown=root:root /out/api/dist ./dist
COPY --from=build --chown=root:root /out/api/package.json ./package.json
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/index.js"]

# ---------- web runtime ----------
FROM ${NGINX_IMAGE} AS web
COPY --chown=root:root apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=root:root /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
