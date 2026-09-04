# Multi-stage (R-20):
#   dev   — vite dev server with HMR; this is what docker compose runs
#   build — production bundle (tsc + vite build)
#   prod  — static files behind nginx, no Node in the final image
#
# compose pins target:dev, so nothing changes for development. Production:
#   docker build --target prod --build-arg VITE_API_URL= \
#     -t billing-frontend ./frontend

# ── dev: vite dev server ────────────────────────────────────────────────
FROM node:20-slim AS dev

WORKDIR /app

# Install from the lockfile so the image matches CI exactly. .dockerignore
# keeps the host's node_modules out — its native binaries are built for the
# developer's OS, not this image.
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── build: production bundle ────────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

# Vite inlines VITE_* at build time — a static bundle has no runtime env,
# so the API URL is a build argument. Leave it empty when nginx proxies
# /api same-origin (see nginx.conf); the app then calls relative paths.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── prod: nginx serving the bundle ──────────────────────────────────────
FROM nginx:1.27-alpine AS prod

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
