import { createValidateEnv } from '@app/api-common/config/validate-env';

export const validateEnv = createValidateEnv({
  stringKeys: [
    'MCP_SERVER_API_KEY',
    'WALLET_API_BASE_URL',
    'WALLET_API_KEY',
    'VOYAGE_API_KEY',
    'VOYAGE_EMBED_MODEL',
    'VECTOR_STORE',
    'LANCEDB_PATH',
    'LANCEDB_TABLE',
    'POSTGRES_HOST',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'POSTGRES_TABLE',
  ],
  numberKeys: ['PORT', 'POSTGRES_PORT'],
  booleanKeys: [],
});
