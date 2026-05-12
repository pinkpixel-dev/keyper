# ╔══════════════════════════════════════════════════════════════╗
# ║              🔐  K E Y P E R  –  Docker Build               ║
# ║         Made with ❤️  by Pink Pixel  ✨  Dream it, Pixel it  ║
# ╚══════════════════════════════════════════════════════════════╝
#
# Multi-stage build:
#   Stage 1 (builder) – Installs deps and compiles the Vite/React app
#   Stage 2 (runner)  – Lightweight nginx server for the static output
#
# Usage:
#   docker build -t keyper .
#   docker run -p 8080:80 keyper
#
# Or with Docker Compose:
#   docker compose up -d

# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:26-alpine AS builder

LABEL org.opencontainers.image.title="Keyper"
LABEL org.opencontainers.image.description="🔐 Self-hosted credential manager with zero-knowledge encryption"
LABEL org.opencontainers.image.source="https://github.com/pinkpixel-dev/keyper"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.authors="Pink Pixel <admin@pinkpixel.dev>"

WORKDIR /app

# Copy dependency manifests first (layer-cache optimisation)
COPY package*.json ./

# Install ALL dependencies (including devDeps needed for build)
RUN npm ci --ignore-scripts

# Copy the rest of the source
COPY . .

# Compile the production bundle
RUN npm run build

# ── Stage 2: Serve ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy the compiled app from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Drop in our custom nginx server config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Validate config then start nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
