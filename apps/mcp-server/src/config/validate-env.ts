import { createValidateEnv } from '@app/api-common/config/validate-env';

export const validateEnv = createValidateEnv({
  stringKeys: [
    'MCP_SERVER_API_KEY',
    'WALLET_API_BASE_URL',
    'WALLET_API_KEY',
    'VOYAGE_API_KEY',
    'VOYAGE_EMBED_MODEL',
    'LANCEDB_PATH',
    'LANCEDB_TABLE',
  ],
  numberKeys: ['PORT'],
  booleanKeys: [],
});
