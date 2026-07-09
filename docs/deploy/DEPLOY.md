# Deployment guide (PC build → staging → Ubuntu server)

This document describes how to build the MCP-demo monorepo on Windows, stage files locally, and deploy to two separate directories on an Ubuntu server.

## Applications

| App | Default port | Server path | PM2 entry |
|-----|--------------|-------------|-----------|
| **mcp-server** | 4000 (`PORT` in `.env`) | `/var/www/mcp-server` | `dist/apps/mcp-server/main.js` |
| **mcp-client** (web UI) | 3001 (`CLIENT_WEB_PORT` in `.env`) | `/var/www/mcp-client` | `dist/apps/mcp-client/server.js` |

Both apps load configuration from **`.env` in the deploy root** (PM2 working directory):

- mcp-server: `/var/www/mcp-server/.env`
- mcp-client: `/var/www/mcp-client/.env`

Local development still uses `apps/mcp-server/.env` and `apps/mcp-client/.env` in the monorepo (loaded as a fallback when the root `.env` is absent).

> **Warning — production `.env`:** Be careful when updating `.env` on the server. Overwriting production `.env` can change API keys, upstream Wallet API URLs, Voyage AI credentials, ports, and other live settings. For routine code-only deploys, upload `dist`, workspace manifests, `package.json`, and `package-lock.json` only.

> **Note — npm workspaces:** Unlike MindShaker-Wallet, runtime dependencies (`@nestjs/core`, etc.) are declared in workspace `package.json` files under `apps/`, not in the root `package.json`. Each deploy folder must include the relevant workspace manifests so `npm ci --omit=dev` installs the correct packages. The compiled mcp-server also `require`s `@app/api-common`, so `libs/api-common/dist/` must be present on the server.

> **Note — mcp-client web assets:** Vite builds the React UI to `apps/mcp-client/web/dist/`. The compiled Express server resolves static files at `dist/apps/web/dist/` relative to the deploy root. The staging script copies the Vite output to that path automatically.

> **Note — RAG knowledge base:** The MCP server needs a LanceDB vector store for `search_knowledge_base`. After deploy, run ingestion on the server (see [§ Knowledge base ingestion](#knowledge-base-ingestion)) or upload an existing `data/lancedb/` tree.

## Prerequisites

- **PC:** Node.js (18+ recommended, 22 preferred), `npm run build` and `npm run build:client:web` from repo root
- **Server:** Node.js, nginx, PM2, **native build tools** (see below)
- **External services:** MindShaker Wallet API (upstream), Anthropic API (mcp-client), Voyage AI (mcp-server RAG)
- Do **not** copy `node_modules` from Windows; run `npm ci --omit=dev` on Linux (several mcp-server dependencies compile native addons on install, e.g. `@lancedb/lancedb` and `tree-sitter` via `llamaindex`)

### Server: install build tools (required for mcp-server)

mcp-server dependencies include native modules that are built with `node-gyp` during `npm ci`. On Ubuntu, install `build-essential` **once** before the first `npm ci`:

```bash
sudo apt update
sudo apt install -y build-essential
```

This provides `make`, `g++`, and other tools needed to compile packages like `tree-sitter` and `@lancedb/lancedb`. Without it, `npm ci` fails with `gyp ERR! stack Error: not found: make`.

## 1. Build on PC

```powershell
cd D:\projectosMindshaker2\MCP-demo
npm ci
npm run build
npm run build:client:web
```

Verify entry files exist. Run these in **PowerShell** (or Windows Terminal with a PowerShell tab)—`Test-Path` is a PowerShell cmdlet, not a Command Prompt command. Each line should print `True` after a successful build.

```powershell
Test-Path D:\projectosMindshaker2\MCP-demo\dist\apps\mcp-server\main.js
Test-Path D:\projectosMindshaker2\MCP-demo\dist\apps\mcp-client\server.js
Test-Path D:\projectosMindshaker2\MCP-demo\apps\mcp-client\web\dist\index.html
```

## 2. Local staging folders

| App | Staging folder |
|-----|----------------|
| mcp-server | `D:\temp\mcp-demo-deploy\mcp-server` |
| mcp-client | `D:\temp\mcp-demo-deploy\mcp-client` |

## 3. Run the staging script (`stage-deploy.ps1`)

Script path: [`docs/deploy/stage-deploy.ps1`](./stage-deploy.ps1)

It copies `dist`, `package.json`, `package-lock.json`, and (by default) each app's `.env` to **`.env` at the staging deploy root**:

- `D:\temp\mcp-demo-deploy\mcp-server\.env`
- `D:\temp\mcp-demo-deploy\mcp-client\.env`

Source in the repo remains `apps\<app>\.env`; staging/production use the deploy root only.

For **mcp-server**, the script also copies:

- `apps\mcp-server\knowledge\` → `knowledge\` (ingestion source docs)
- `apps\mcp-server\package.json` → `apps\mcp-server\package.json` (workspace manifest)
- `libs\api-common\package.json` + `libs\api-common\dist\` → `libs\api-common\` (shared lib required at runtime)

For **mcp-client**, the script copies:

- `apps\mcp-client\web\dist\` → `dist\apps\web\dist\` (production static assets)
- `apps\mcp-client\package.json` → `apps\mcp-client\package.json` (workspace manifest)

### Before you run

1. **Build** the project (`npm run build` and `npm run build:client:web`) so `dist` contains the server entry files and the Vite web bundle exists.
2. **`.env` files** (required unless you use `-SkipEnvCopy`):
   - `apps\mcp-server\.env`
   - `apps\mcp-client\.env`  
   If missing, copy from `.env.template` and adjust values.
3. **PowerShell execution policy** (if the script is blocked):

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

   Or run once without changing policy:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\docs\deploy\stage-deploy.ps1
   ```

### Standard run (includes `.env`)

Open **PowerShell**, go to the **repo root**, build, then stage:

```powershell
cd D:\projectosMindshaker2\MCP-demo

npm run build
npm run build:client:web

.\docs\deploy\stage-deploy.ps1
```

The script resolves the repo root from its own file location (`docs\deploy\..\..`), so your **current directory does not matter**. Using `cd` to the repo root first is recommended so relative paths in the examples are easy to follow.

### Run without copying `.env`

Use this for **code-only** deploys when production `.env` on the server must not change:

```powershell
cd D:\projectosMindshaker2\MCP-demo
npm run build
npm run build:client:web
.\docs\deploy\stage-deploy.ps1 -SkipEnvCopy
```

### What you should see

On success:

- Lines showing repo root and staging root
- `Copied .env (mcp-server) -> ...` and/or `Copied .env (mcp-client) -> ...` (unless `-SkipEnvCopy` or `.env` missing)
- `Copied knowledge docs -> ...` (mcp-server)
- `Copied workspace manifest -> ...` and `Copied workspace lib -> ...` (mcp-server)
- `Copied web client static assets -> ...` and `Copied workspace manifest -> ...` (mcp-client)
- Yellow **WARNING** messages when `.env` files were copied (production reminder)
- `Staging complete.` with both staging folder paths
- A final summary warning listing staged `.env` paths (if any were copied)

On failure, the script stops with an error, for example:

| Message | What to do |
|---------|------------|
| `dist folder not found` | Run `npm run build` |
| `main.js not found` | Run `npm run build`; confirm `dist\apps\mcp-server\main.js` |
| `server.js not found` | Run `npm run build`; confirm `dist\apps\mcp-client\server.js` |
| `web dist not found` | Run `npm run build:client:web` |
| `api-common dist not found` | Run `npm run build` (builds `libs/api-common/dist`) |
| `Skipped .env (not found)` | Create `.env` from `.env.template`, or use `-SkipEnvCopy` |

### Full deploy workflow (PC)

```powershell
cd D:\projectosMindshaker2\MCP-demo
npm ci
npm run build
npm run build:client:web
.\docs\deploy\stage-deploy.ps1
# Upload D:\temp\mcp-demo-deploy\mcp-server and ...\mcp-client to the server
```

Templates for `.env`: `apps/mcp-server/.env.template`, `apps/mcp-client/.env.template`.

## 4. What to copy — PC repo → staging

### mcp-server → `D:\temp\mcp-demo-deploy\mcp-server`

| Copy from (local PC) | Copy to (staging) |
|----------------------|-------------------|
| `D:\projectosMindshaker2\MCP-demo\dist\` (entire folder) | `D:\temp\mcp-demo-deploy\mcp-server\dist\` |
| `D:\projectosMindshaker2\MCP-demo\package.json` | `D:\temp\mcp-demo-deploy\mcp-server\package.json` |
| `D:\projectosMindshaker2\MCP-demo\package-lock.json` | `D:\temp\mcp-demo-deploy\mcp-server\package-lock.json` |
| `D:\projectosMindshaker2\MCP-demo\apps\mcp-server\.env` (unless `-SkipEnvCopy`) | `D:\temp\mcp-demo-deploy\mcp-server\.env` |
| `D:\projectosMindshaker2\MCP-demo\apps\mcp-server\knowledge\` | `D:\temp\mcp-demo-deploy\mcp-server\knowledge\` |
| `D:\projectosMindshaker2\MCP-demo\apps\mcp-server\package.json` | `D:\temp\mcp-demo-deploy\mcp-server\apps\mcp-server\package.json` |
| `D:\projectosMindshaker2\MCP-demo\libs\api-common\package.json` | `D:\temp\mcp-demo-deploy\mcp-server\libs\api-common\package.json` |
| `D:\projectosMindshaker2\MCP-demo\libs\api-common\dist\` | `D:\temp\mcp-demo-deploy\mcp-server\libs\api-common\dist\` |

### mcp-client → `D:\temp\mcp-demo-deploy\mcp-client`

| Copy from (local PC) | Copy to (staging) |
|----------------------|-------------------|
| `D:\projectosMindshaker2\MCP-demo\dist\` (entire folder) | `D:\temp\mcp-demo-deploy\mcp-client\dist\` |
| `D:\projectosMindshaker2\MCP-demo\package.json` | `D:\temp\mcp-demo-deploy\mcp-client\package.json` |
| `D:\projectosMindshaker2\MCP-demo\package-lock.json` | `D:\temp\mcp-demo-deploy\mcp-client\package-lock.json` |
| `D:\projectosMindshaker2\MCP-demo\apps\mcp-client\.env` (unless `-SkipEnvCopy`) | `D:\temp\mcp-demo-deploy\mcp-client\.env` |
| `D:\projectosMindshaker2\MCP-demo\apps\mcp-client\web\dist\` | `D:\temp\mcp-demo-deploy\mcp-client\dist\apps\web\dist\` |
| `D:\projectosMindshaker2\MCP-demo\apps\mcp-client\package.json` | `D:\temp\mcp-demo-deploy\mcp-client\apps\mcp-client\package.json` |

Each staging folder receives a **full** `dist` tree (both apps). Workspace manifests under `apps/` and `libs/` are copied separately (not inside `dist/`).

## 5. What to copy — staging → Ubuntu server

Upload the contents of each staging folder (e.g. WinSCP, `scp`, `rsync`) to:

### mcp-server → `/var/www/mcp-server`

| Copy from (staging) | Copy to (server) |
|---------------------|------------------|
| `D:\temp\mcp-demo-deploy\mcp-server\dist\` | `/var/www/mcp-server/dist/` |
| `D:\temp\mcp-demo-deploy\mcp-server\package.json` | `/var/www/mcp-server/package.json` |
| `D:\temp\mcp-demo-deploy\mcp-server\package-lock.json` | `/var/www/mcp-server/package-lock.json` |
| `D:\temp\mcp-demo-deploy\mcp-server\.env` | `/var/www/mcp-server/.env` (only when intentionally updating config) |
| `D:\temp\mcp-demo-deploy\mcp-server\knowledge\` | `/var/www/mcp-server/knowledge/` |
| `D:\temp\mcp-demo-deploy\mcp-server\apps\mcp-server\package.json` | `/var/www/mcp-server/apps/mcp-server/package.json` |
| `D:\temp\mcp-demo-deploy\mcp-server\libs\api-common\` | `/var/www/mcp-server/libs/api-common/` |

### mcp-client → `/var/www/mcp-client`

| Copy from (staging) | Copy to (server) |
|---------------------|------------------|
| `D:\temp\mcp-demo-deploy\mcp-client\dist\` | `/var/www/mcp-client/dist/` |
| `D:\temp\mcp-demo-deploy\mcp-client\package.json` | `/var/www/mcp-client/package.json` |
| `D:\temp\mcp-demo-deploy\mcp-client\package-lock.json` | `/var/www/mcp-client/package-lock.json` |
| `D:\temp\mcp-demo-deploy\mcp-client\.env` | `/var/www/mcp-client/.env` (only when intentionally updating config) |
| `D:\temp\mcp-demo-deploy\mcp-client\apps\mcp-client\package.json` | `/var/www/mcp-client/apps/mcp-client/package.json` |

## 6. Do not copy

| Path | Reason |
|------|--------|
| `D:\projectosMindshaker2\MCP-demo\node_modules\` | Run `npm ci --omit=dev` on the server (native modules e.g. `@lancedb/lancedb` must be built for Linux) |
| `apps\*\src\`, `libs\*\src\`, `test\` | Source is not required at runtime (deploy `libs/api-common/dist/` only) |
| `.git\` | Optional; only if deploying via git on the server |

## 7. Server setup (after upload)

Install production dependencies **on the server** in each directory. Use the **workspace flag** so npm installs the app’s runtime dependencies (root `package.json` alone has no production `dependencies`):

```bash
cd /var/www/mcp-server
npm ci --omit=dev --workspace=@mcp-demo/mcp-server

cd /var/www/mcp-client
npm ci --omit=dev --workspace=@mcp-demo/mcp-client
```

Verify packages were installed before starting the apps:

```bash
ls /var/www/mcp-server/node_modules/@nestjs/core    # should exist
ls /var/www/mcp-server/node_modules/@app/api-common # should exist (links to libs/api-common)
```

Create or edit production `.env` files if not uploaded. Set **different** ports per app (e.g. `PORT=4000` for mcp-server, `CLIENT_WEB_PORT=3001` for mcp-client). Point `MCP_SERVER_URL` in the client `.env` at the production MCP endpoint (e.g. `http://127.0.0.1:4000/mcp/v1` when both apps run on the same host).

### Do not use `npm run start` on the server

After `npm ci --omit=dev`, **`npm run start` will fail** with `nest: not found` (mcp-server) or missing `tsx` (mcp-client). That is expected:

- `npm run start` runs `nest start` or `tsx src/server.ts`, which need **dev dependencies**.
- `--omit=dev` does not install the Nest CLI or `tsx` — the server only needs runtime packages plus your pre-built **`dist/`** from the PC.

On the server, run the **compiled JavaScript** with Node (or PM2 below), not the Nest CLI or `tsx`:

```bash
cd /var/www/mcp-server
node dist/apps/mcp-server/main.js
```

```bash
cd /var/www/mcp-client
NODE_ENV=production node dist/apps/mcp-client/server.js
```

Use **`npm run start`** only on your PC for local development (where dev dependencies are installed).

### PM2

```bash
cd /var/www/mcp-server
pm2 start dist/apps/mcp-server/main.js --name mcp-server

cd /var/www/mcp-client
NODE_ENV=production pm2 start dist/apps/mcp-client/server.js --name mcp-client

pm2 save
```

To persist `NODE_ENV=production` for mcp-client under PM2, use an ecosystem file or:

```bash
pm2 start dist/apps/mcp-client/server.js --name mcp-client --node-args="" --update-env --env production
# or set in ecosystem.config.js: env: { NODE_ENV: 'production' }
```

### Knowledge base ingestion

After the first deploy (or when `apps/mcp-server/knowledge/` documents change), build the LanceDB vector store on the server:

```bash
cd /var/www/mcp-server
node dist/apps/mcp-server/mcp/knowledge/ingest.js
```

This reads `knowledge/` under the deploy root and writes to `data/lancedb/` (or the path set by `LANCEDB_PATH` in `.env`). Requires a valid `VOYAGE_API_KEY` in `.env`.

Alternatively, upload a pre-built `data/lancedb/` folder from your PC instead of running ingestion on the server.

### Health checks

```bash
curl -s http://127.0.0.1:4000/              # mcp-server (Nest root)
curl -s http://127.0.0.1:3001/api/health   # mcp-client web API
```

Point nginx at these local ports (HTTPS in production). The MCP Streamable HTTP endpoint is `POST /mcp/v1` on the mcp-server port (requires `x-api-key`).

## 8. Expected layout on the server

```text
/var/www/mcp-server/
├── .env                   ← PM2 cwd; ConfigModule loads this file
├── apps/
│   └── mcp-server/
│       └── package.json   ← workspace manifest (runtime deps)
├── libs/
│   └── api-common/
│       ├── package.json
│       └── dist/          ← built shared lib (required at runtime)
├── dist/
├── knowledge/             ← source docs for ingestion
├── data/
│   └── lancedb/           ← generated by ingest (or uploaded)
├── package.json           ← root workspace config
├── package-lock.json
└── node_modules/          ← from npm ci --workspace=@mcp-demo/mcp-server

/var/www/mcp-client/
├── .env
├── apps/
│   └── mcp-client/
│       └── package.json   ← workspace manifest (runtime deps)
├── dist/
│   └── apps/
│       ├── mcp-client/    ← compiled Express server (server.js)
│       └── web/
│           └── dist/      ← Vite static assets (index.html, assets/)
├── package.json
├── package-lock.json
└── node_modules/          ← from npm ci --workspace=@mcp-demo/mcp-client
```

## 9. Updates

1. `npm run build` and `npm run build:client:web` on PC  
2. Run [`.\docs\deploy\stage-deploy.ps1`](./stage-deploy.ps1)  
3. Upload staging folders to the server (overwrite `dist`, `apps/`, `libs/` as applicable, `package.json`, `package-lock.json`)  
4. On server: `npm ci --omit=dev --workspace=...` when dependencies changed  
5. `pm2 restart mcp-server` and `pm2 restart mcp-client`  
6. Re-run knowledge ingestion when `knowledge/` docs changed  
7. Do not overwrite production `.env` unless intentional (the staging script warns when `.env` was copied)  

## 10. Troubleshooting

### `Cannot find module '@nestjs/core'` (or other missing packages)

This means `node_modules` on the server does not contain the app’s runtime dependencies. Common causes:

| Cause | Fix |
|-------|-----|
| Only root `package.json` was uploaded (no `apps/mcp-server/package.json`) | Upload workspace manifests from staging; re-run `npm ci --omit=dev --workspace=@mcp-demo/mcp-server` |
| `npm ci` run without `--workspace` | Root `package.json` has no production `dependencies`; use the workspace flag (see [§ 7](#7-server-setup-after-upload)) |
| `libs/api-common/dist/` missing | Upload `libs/api-common/` from staging; mcp-server requires `@app/api-common` at runtime |
| `npm ci` never run | Run `npm ci --omit=dev --workspace=@mcp-demo/mcp-server` before `node dist/...` |

### `Cannot find module '@app/api-common/...'`

Upload `libs/api-common/package.json` and `libs/api-common/dist/` to the server, then re-run `npm ci --omit=dev --workspace=@mcp-demo/mcp-server`.

### `npm ci` fails: `gyp ERR! stack Error: not found: make` (tree-sitter / node-gyp)

Native dependencies (notably `tree-sitter` from the `llamaindex` stack, and `@lancedb/lancedb`) are compiled on the server during `npm ci`. The server is missing the C/C++ build toolchain.

```bash
sudo apt update
sudo apt install -y build-essential
```

Then remove the partial install and retry:

```bash
cd /var/www/mcp-server
rm -rf node_modules
npm ci --omit=dev --workspace=@mcp-demo/mcp-server
```

## 11. Ubuntu: `npm ci` permission problems

If `sudo npm ci --omit=dev` fails with `sudo: npm: command not found`, do **not** use `sudo` for npm — root often does not have Node/npm on its PATH.

If `npm ci --omit=dev` fails with `EACCES: permission denied` on `node_modules`, the deploy folder is not writable by your user. Typical errors:

```text
npm error code EACCES
npm error syscall mkdir
npm error path /var/www/mcp-server/node_modules
npm error errno -13
```

Fix permissions so your user can write to the deploy directory (example user: `jnovais`). Repeat for `/var/www/mcp-client` if needed.

### Step 1: Add yourself to the web server group

The folder may already belong to the `www-data` group. Add your user to that group so you inherit its permissions:

```bash
sudo usermod -aG www-data jnovais
```

Replace `jnovais` with your SSH login if different.

### Step 2: Activate the group change

For Ubuntu to recognize the new group membership in your **current** terminal session:

```bash
newgrp www-data
```

Alternatively, log out and log back into the server (`newgrp` avoids that).

### Step 3: Give the group write permissions

If the group only has read and execute (`r-x`), add write for the deploy folder and its contents:

```bash
sudo chmod -R g+w /var/www/mcp-server
sudo chmod -R g+w /var/www/mcp-client
```

Check with `ls -l /var/www` — permissions should change from `drwxr-xr-x` to `drwxrwxr-x` (extra `w` for the group).

### Step 4: Run npm (without sudo)

```bash
cd /var/www/mcp-server
npm ci --omit=dev --workspace=@mcp-demo/mcp-server
```

```bash
cd /var/www/mcp-client
npm ci --omit=dev --workspace=@mcp-demo/mcp-client
```

Run PM2 as the same user; avoid `sudo npm install`, which creates root-owned `node_modules` and causes the same problem again.

## Related docs

- [README.md](../../README.md) — apps, ports, env variables  
- [rag-knowledge-base.md](../rag-knowledge-base.md) — RAG setup and `search_knowledge_base`  
- [testing-mcp-endpoint.md](../testing-mcp-endpoint.md) — curl examples for `POST /mcp/v1`  
- `apps/mcp-server/.env.template`, `apps/mcp-client/.env.template`
