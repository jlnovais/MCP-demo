import { bootstrap } from './bootstrap.js';
import { runChat } from './chat.js';
import { loadEnv } from './env.js';

loadEnv();

const app = await bootstrap();
await runChat(app);
