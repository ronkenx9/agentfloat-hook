# Deploying the AgentFloat agent (read-only) to Railway

This hosts the watcher + orchestrator + REST API so `agentfloat.app` shows
**live** data instead of the demo fallback.

It runs in **read-only mode** (`CHAIN_WRITES_ENABLED=false`): it reads the
chain, computes live scores, runs the orchestrator via the Bankr LLM gateway,
and serves the dashboard — but performs **no on-chain writes**, so it needs
**no signing keys**. On-chain scoring/promotion stays on your local/minimal
wallet. (To let the cloud write on-chain later, set `CHAIN_WRITES_ENABLED=true`
and add `PROMOTER_PRIVATE_KEY` = the minimal wallet `0x8C9A…59F3`, funded with a
little OKB.)

## 1. Create the Railway service

1. railway.app → **New Project → Deploy from GitHub repo** → `ronkenx9/agentfloat-hook`.
2. In the service **Settings**:
   - **Root Directory:** `agent`  ← critical (build context = the agent dir; it picks up `agent/Dockerfile`).
   - Builder: **Dockerfile** (auto-detected).
   - Health check path: `/api/health`.

## 2. Environment variables (Railway → Variables)

No private keys. Paste these:

```
CHAIN_WRITES_ENABLED=false
X_LAYER_RPC_URL=https://rpc.xlayer.tech
X_LAYER_CHAIN_ID=196
VAULT_ADDRESS=0xbF06de108735332D1EDb81C7A77A750DD428a6f4
HOOK_ADDRESS=0x5Ba6671e8219C34edA373BF95895306929174580
DASHBOARD_ORIGIN=https://agentfloat.app
BANKR_LLM_KEY=<your LLM-gateway key>     # LLM-only, read-only key — never a wallet key
```

Notes:
- `BRAIN_PATH` is baked into the image (`/app/brain-seed`) — no need to set it.
- `PORT` is injected by Railway; the API reads it automatically.
- Do **not** set `PROMOTER_PRIVATE_KEY` / `DECRYPTION_PASSWORD` for the read-only deploy.

## 3. Deploy & grab the URL

Railway builds the Docker image (installs deps, compiles `better-sqlite3`) and
starts the agent. When it's live you get a public URL like
`https://agentfloat-agent.up.railway.app`. Hit `…/api/health` → `{ ok: true }`.

## 4. Point the site at it

In **Vercel → agentfloat project → Settings → Environment Variables**:

```
NEXT_PUBLIC_AGENT_API_URL = https://<your-railway-url>
```

Redeploy the frontend. The `isDemo` badge flips off and `agentfloat.app` renders
live data.

Optional, cleaner: add a Railway custom domain `api.agentfloat.app` and set
`NEXT_PUBLIC_AGENT_API_URL` to that instead.

## CORS

`DASHBOARD_ORIGIN=https://agentfloat.app` is what lets the credentialed admin
endpoints accept the site (public reads work regardless). If you add a custom
API domain or a preview origin, update `DASHBOARD_ORIGIN` accordingly.

## What "live" means here

- ✅ Live: on-chain reads (vault/strategy state), computed scores each epoch,
  orchestrator proposals (written to the in-container brain seed), mode, health.
- ⚠️ Ephemeral: new proposals/scores accumulate on the container FS and reset on
  redeploy (the committed `brain-seed/` is the starting point). Mount a Railway
  volume at `/app/brain-seed` if you want them to persist across deploys.
- ⛔ Not on cloud: on-chain score posting / promotions (those stay on your keyed
  wallet, by design).
