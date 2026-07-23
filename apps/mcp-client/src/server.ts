import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createBasicAuthMiddleware } from './basic-auth.js';
import { bootstrap } from './common/bootstrap.js';
import { streamChatTurn } from './common/chat-engine.js';
import { loadEnv, requireEnv } from './common/env.js';
import { SessionStore } from './common/sessions.js';
import type { ChatStreamEvent, ServerConfig } from './common/types.js';

function parseChatMessage(body: unknown): string | undefined {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    const trimmed = body.message.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', 'web');
const webDist = path.resolve(webRoot, 'dist');

const port = Number(process.env.CLIENT_WEB_PORT ?? 3001);
const isDev = process.env.NODE_ENV !== 'production';
const webUsername = requireEnv('CLIENT_WEB_USERNAME');
const webPassword = requireEnv('CLIENT_WEB_PASSWORD');

const app = express();
app.use(express.json());
app.use(createBasicAuthMiddleware(webUsername, webPassword));

const sessions = new SessionStore();
let appContext: Awaited<ReturnType<typeof bootstrap>>;

try {
  appContext = await bootstrap({
    onMcpError: (description, detail) => {
      console.warn(`${description}: ${detail}`);
      console.warn('Web client will run without MCP tools.');
    },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const serverConfig: ServerConfig = {
  model: appContext.model,
  mcpConnected: appContext.mcpConnected,
  toolCount: appContext.tools.length,
  tools: appContext.tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
  })),
  promptCacheTtl: appContext.promptCacheTtl,
};

console.log(`MCP web client running on http://localhost:${port}`);
console.log(`Model: ${appContext.model}`);
console.log(
  `MCP: ${appContext.mcpConnected ? `${appContext.tools.length} tools` : 'not connected'}`,
);
console.log(
  `Prompt cache: ${appContext.promptCacheEnabled ? `enabled (TTL ${appContext.promptCacheTtl})` : 'disabled'}`,
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (_req, res) => {
  res.json(serverConfig);
});

app.get('/api/sessions', (_req, res) => {
  res.json(sessions.list());
});

app.post('/api/sessions', (_req, res) => {
  res.status(201).json(sessions.create());
});

app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

app.delete('/api/sessions/:id', (req, res) => {
  if (!sessions.delete(req.params.id)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.status(204).end();
});

app.post('/api/sessions/:id/chat', async (req, res) => {
  const sessionId = req.params.id;
  const messages = sessions.getMessages(sessionId);
  if (!messages) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const message = parseChatMessage(req.body);
  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  sessions.touch(sessionId, message);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: ChatStreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await streamChatTurn(appContext, messages, message, send);
  } catch (error) {
    messages.pop();
    send({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
    res.end();
    return;
  }

  res.end();
});

if (isDev) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: webRoot,
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

const server = app.listen(port);

const shutdown = async () => {
  server.close();
  await appContext.transport?.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
