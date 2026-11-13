# syntax=docker/dockerfile:1.7
# Multi-stage build for both services. Targets: `api`, `web`.

ARG NODE_IMAGE=node:24.22.2-alpine3.24
# Must match the Alpine release NODE_IMAGE is built on (musl/libstdc++ ABI).
ARG ALPINE_IMAGE=alpine:3.24.4
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29.8-alpine

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
    pnpm install --frozen-lockfile --filter '!@wedding/e2e'

# ---------- build ----------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @wedding/api build \
 && pnpm --filter @wedding/web build \
 && pnpm --filter @wedding/api deploy --prod --legacy /out/api \
 && cp -r apps/api/dist /out/api/dist

# Prune what the runtime never loads: other-OS native prebuilds, glibc libvips
# (we run on musl), bundled C sources, type declarations and docs.
RUN cd /out/api/node_modules/.pnpm \
 && ARCH="$(node -p process.arch)" \
 && rm -rf @img+sharp-libvips-linux-"$ARCH"@* @img+sharp-linux-"$ARCH"@* @types+* \
 && find . -type d \( -path '*/better-sqlite3/deps' -o -path '*/better-sqlite3/src' \) -prune -exec rm -rf {} + \
 && find . -type d -name prebuilds -prune -exec sh -c 'for d in "$1"/*; do case "${d##*/}" in linux-"$2"|linux-"$2".*|linuxmusl-"$2"|linuxmusl-"$2".*) ;; *) rm -rf "$d" ;; esac; done' _ {} "$ARCH" \; \
 && find . -type f \( -name '*.md' -o -name '*.d.ts' -o -name '*.d.cts' -o -name '*.d.mts' -o -name '*.map' \) -delete

# Normalise permissions: the checkout's mode bits (e.g. a umask-077 clone on the
# server) must not leak into the images, whose runtimes run as non-root users.
RUN chmod -R u=rwX,go=rX /out/api /repo/apps/web/dist

# ---------- node binary only (no npm/yarn/corepack in the runtime) ----------
FROM ${NODE_IMAGE} AS node

# ---------- api runtime ----------
FROM ${ALPINE_IMAGE} AS api
ENV NODE_ENV=production \
    API_PORT=3000 \
    DATA_DIR=/data \
    UPLOAD_DIR=/uploads
RUN apk add --no-cache libstdc++ \
 && addgroup -g 1000 node \
 && adduser -u 1000 -G node -s /sbin/nologin -D -H node \
 && mkdir -p /data /uploads /app \
 && chown node:node /data /uploads
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
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
COPY --chown=root:root --chmod=0644 apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=root:root /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
