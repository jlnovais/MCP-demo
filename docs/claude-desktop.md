# Adding the MCP server to Claude Desktop

This guide explains how to connect Claude Desktop to the local `@mcp-demo/mcp-server` instance.

Claude Desktop's `claude_desktop_config.json` only launches **stdio** MCP servers directly. Our server speaks **Streamable HTTP** at `POST /mcp/v1`, so you bridge it with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) — a small proxy that Claude starts as a local process and that forwards requests to the HTTP endpoint.

## Prerequisites

1. **Node.js 18+** installed (required by `npx` and `mcp-remote`).
2. **Claude Desktop** with Developer Mode enabled:
   - Open **Settings → Developer**
   - Enable developer features if prompted
3. **MCP server running** on your machine (see [testing-mcp-endpoint.md](./testing-mcp-endpoint.md)):

   ```bash
   npm run start:server:dev
   ```

4. **Environment configured** in `apps/mcp-server/.env`:

   | Variable | Purpose |
   | --- | --- |
   | `PORT` | MCP server port (default `4000`) |
   | `MCP_SERVER_API_KEY` | Key Claude must send as `x-api-key` |
   | `WALLET_API_KEY` | Required for payment tools to call the Wallet API |
   | `WALLET_API_BASE_URL` | Wallet API base URL (defaults to `http://localhost:3000`) |

5. **Wallet API running** if you plan to use the payment tools from Claude.

## Configuration file location

| OS | Path |
| --- | --- |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |

Open it from Claude Desktop: **Settings → Developer → Edit Config**.

If the file does not exist, create it with at least:

```json
{
  "mcpServers": {}
}
```

## Recommended setup (local HTTP via mcp-remote)

Add an entry under `mcpServers`. Replace `YOUR_MCP_SERVER_API_KEY` with the same value as `MCP_SERVER_API_KEY` in `apps/mcp-server/.env`.

### Windows

```json
{
  "mcpServers": {
    "mindshaker-wallet": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://127.0.0.1:4000/mcp/v1",
        "--header",
        "x-api-key:${MCP_API_KEY}"
      ],
      "env": {
        "MCP_API_KEY": "YOUR_MCP_SERVER_API_KEY"
      }
    }
  }
}
```

> **Windows note:** Claude Desktop on Windows can mishandle spaces inside `args`. Keep the header value in `env` and reference it as `${MCP_API_KEY}` with **no spaces around the colon** in `--header`.

If `npx` fails to spawn correctly, use the full path to `mcp-remote` instead:

```json
"command": "C:\\Users\\YourName\\AppData\\Roaming\\npm\\mcp-remote.cmd"
```

Find the path by running `where mcp-remote` in a terminal (after `npm install -g mcp-remote`).

### macOS / Linux

```json
{
  "mcpServers": {
    "mindshaker-wallet": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://127.0.0.1:4000/mcp/v1",
        "--header",
        "x-api-key:${MCP_API_KEY}"
      ],
      "env": {
        "MCP_API_KEY": "YOUR_MCP_SERVER_API_KEY"
      }
    }
  }
}
```

### Config reference

| Field | Value |
| --- | --- |
| `command` | `npx` (or full path to `mcp-remote`) |
| URL in `args` | `http://127.0.0.1:<PORT>/mcp/v1` — use `127.0.0.1`, not `localhost`, if you hit DNS issues |
| `--header` | `x-api-key:${MCP_API_KEY}` — matches `ApiKeyGuard` in the MCP server |
| `env.MCP_API_KEY` | Same value as `MCP_SERVER_API_KEY` in `apps/mcp-server/.env` |

If you changed `PORT` in `.env`, update the URL accordingly.

## Apply the configuration

1. Save `claude_desktop_config.json`.
2. **Fully quit** Claude Desktop (not just close the window).
3. Ensure the MCP server is running (`npm run start:server:dev`).
4. Relaunch Claude Desktop.

MCP servers are loaded at startup. A full restart is required after config changes.

## Verify the connection

1. Look for the **hammer icon** (tools) near the message input in Claude Desktop.
2. Click it — you should see tools from `mindshaker-wallet`:
   - `create_payment`
   - `list_payments`
   - `get_payment`
   - `cancel_payment`
3. Ask Claude something like: *"List payment requests for merchant X"* and confirm it invokes a tool.

If tools do not appear, check **Settings → Developer** for MCP server errors, or inspect Claude's logs (see [Troubleshooting](#troubleshooting)).

## Alternative: Custom Connector (HTTPS only)

Claude Desktop also supports remote MCP servers via **Settings → Connectors → Add custom connector**. That path is intended for **public HTTPS** endpoints reached from Anthropic's infrastructure — **not** for `http://localhost`.

Use this only if you expose the MCP server on a public HTTPS URL (for example via a tunnel). Custom Connectors do not support arbitrary `x-api-key` headers today, so this approach is a poor fit for our API-key-protected local server. Prefer the `mcp-remote` setup above for local development.

## Do not use a bare `url` field

Claude Desktop's JSON config does **not** support entries like:

```json
{
  "mcpServers": {
    "mindshaker-wallet": {
      "url": "http://127.0.0.1:4000/mcp/v1"
    }
  }
}
```

Claude Desktop may silently remove invalid entries on restart. Always use the `command` + `mcp-remote` pattern for local HTTP servers.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| No hammer icon / no tools | Fully quit and relaunch Claude Desktop; confirm JSON is valid |
| MCP server error on startup | `MCP_SERVER_API_KEY` set in `.env`; MCP server running on the configured port |
| `401 Unauthorized` | `MCP_API_KEY` in Claude config matches `MCP_SERVER_API_KEY` in `apps/mcp-server/.env` |
| Connection refused | Start the MCP server; confirm URL port matches `PORT` in `.env` |
| Payment tools fail | Wallet API running; `WALLET_API_KEY` set in `.env` |
| `npx` / spawn errors on Windows | Use full path to `mcp-remote.cmd`; ensure Node.js is on your PATH |
| Config keeps disappearing | Invalid `url`-only entries — use `command` + `mcp-remote` instead |

### Test the server independently

Before debugging Claude Desktop, confirm the HTTP endpoint works with curl. See [testing-mcp-endpoint.md](./testing-mcp-endpoint.md).

### Claude Desktop logs

- **Windows:** `%APPDATA%\Claude\logs\`
- **macOS:** `~/Library/Logs/Claude/`

Look for MCP or `mcp-remote` errors after restart.

## Related docs

- [Testing the MCP endpoint](./testing-mcp-endpoint.md) — curl-based verification
- [Model Context Protocol](https://modelcontextprotocol.io/) — protocol overview
- [mcp-remote on npm](https://www.npmjs.com/package/mcp-remote) — HTTP-to-stdio bridge used by this setup
