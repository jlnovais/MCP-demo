export type EnvLike = Record<string, unknown>;

function emptyToUndefined(value: unknown): unknown {
  if (value === '') return undefined;
  return value;
}

function toOptionalNumber(value: unknown): number | undefined {
  const v = emptyToUndefined(value);
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  const v = emptyToUndefined(value);
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return Boolean(v);
}

/**
 * Parses env-style booleans. Unset values use `defaultValue`.
 * False when the value is `false`, `0`, or `false`/`0` (case-insensitive, trimmed).
 */
export function parseEnvBoolean(
  value: unknown,
  defaultValue: boolean,
): boolean {
  const v = emptyToUndefined(value);
  if (v === undefined || v === null) return defaultValue;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const normalized = v.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0') return false;
    return true;
  }
  return Boolean(v);
}

export interface ValidateEnvOptions {
  stringKeys: readonly string[];
  numberKeys: readonly string[];
  booleanKeys: readonly string[];
}

/**
 * Creates a ConfigModule-compatible env validator that normalizes values
 * based on the provided key lists. Each app can pass its own keys.
 */
export function createValidateEnv(options: ValidateEnvOptions) {
  const { stringKeys, numberKeys, booleanKeys } = options;

  return function validateEnv(config: EnvLike): EnvLike {
    const next: EnvLike = { ...config };

    for (const key of stringKeys) next[key] = emptyToUndefined(next[key]);
    for (const key of numberKeys) next[key] = toOptionalNumber(next[key]);
    for (const key of booleanKeys) next[key] = toOptionalBoolean(next[key]);

    return next;
  };
}
