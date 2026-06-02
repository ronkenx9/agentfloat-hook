# AgentFloat agent — read-only cloud build (Railway).
# Build context = the agent/ directory (set Root Directory = "agent" in Railway).
#
# Runs the watcher + orchestrator + REST API. In read-only mode
# (CHAIN_WRITES_ENABLED=false) it holds NO signing keys: it reads the chain,
# computes live scores, runs the orchestrator via the Bankr LLM gateway, and
# serves the dashboard. On-chain writes stay on the local/minimal wallet.

FROM node:20-bookworm-slim

WORKDIR /app

# Build toolchain for better-sqlite3's native addon.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching. --include=dev guarantees ts-node is
# present at runtime even if the build env sets NODE_ENV=production.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# App source + vendored brain seed.
COPY . .

ENV NODE_ENV=production \
    BRAIN_PATH=/app/brain-seed \
    CHAIN_WRITES_ENABLED=false

# Railway injects $PORT; the API reads it. EXPOSE is documentation only.
EXPOSE 4000

CMD ["npx", "ts-node", "src/index.ts"]
