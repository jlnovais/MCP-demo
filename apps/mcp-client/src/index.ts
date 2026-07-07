import { bootstrap } from './common/bootstrap.js';
import { runChat } from './chat.js';
import { loadEnv } from './common/env.js';
import { printStartupBanner } from './io.js';
import { requireEnv } from './common/env.js';

loadEnv();

try {
  requireEnv('ANTHROPIC_API_KEY');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const app = await bootstrap({
  onMcpError: (description, detail) => {
    console.error(`${description}: ${detail}`);
    console.error('Continuing without MCP tools.');
  },
});

printStartupBanner({
  model: app.model,
  tools: app.tools,
  apiKey: requireEnv('ANTHROPIC_API_KEY'),
});

await runChat(app);
