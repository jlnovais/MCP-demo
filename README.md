# MCP Demo

A monorepo for experimenting with the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). It contains two apps: an MCP server built with NestJS and an MCP client (placeholder for now).

## Project structure

```
MCP-demo/
├── apps/
│   ├── mcp-server/    # NestJS app — MCP server (skeleton)
│   └── mcp-client/    # MCP client (placeholder)
├── package.json       # Root workspace config
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (22 recommended)
- npm 9+

## Getting started

Install dependencies from the repository root:

```bash
npm install
```

## Scripts

Run these from the repository root:

| Script | Description |
| --- | --- |
| `npm run start:server` | Start the NestJS MCP server |
| `npm run start:server:dev` | Start the server with hot reload |
| `npm run start:client` | Run the MCP client placeholder |
| `npm run build` | Build all workspaces |

You can also run scripts inside a single app with the `-w` flag:

```bash
npm run start:dev -w @mcp-demo/mcp-server
npm run build -w @mcp-demo/mcp-client
```

## Apps

### `@mcp-demo/mcp-server`

A minimal [NestJS](https://nestjs.com/) application that will host the MCP server. It currently boots an empty `AppModule` with no routes or MCP integration yet.

- **Port:** `3000` (override with the `PORT` environment variable)
- **Source:** `apps/mcp-server/src/`

### `@mcp-demo/mcp-client`

A placeholder MCP client. It currently prints `Hello World` and will be implemented in a future iteration.

- **Source:** `apps/mcp-client/src/`

## Workspaces

This project uses [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces). Dependencies are hoisted to the root `node_modules/`, and each app under `apps/` has its own `package.json`.

## License

ISC
