import { createValidateEnv } from '@app/api-common/config/validate-env';

export const validateEnv = createValidateEnv({
  stringKeys: [
    'API_KEY',
  ],
  numberKeys: [
    'PORT',
  ],
  booleanKeys: [

  ],
});
