import { config } from 'dotenv';
import path from 'node:path';

export function loadEnv(): void {
  config({ path: path.join(process.cwd(), '.env'), quiet: true });
  config({
    path: path.join(process.cwd(), 'apps', 'mcp-client', '.env'),
    quiet: true,
  });
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}
