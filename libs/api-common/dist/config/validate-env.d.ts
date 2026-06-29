export type EnvLike = Record<string, unknown>;
export declare function parseEnvBoolean(
  value: unknown,
  defaultValue: boolean,
): boolean;
export interface ValidateEnvOptions {
  stringKeys: readonly string[];
  numberKeys: readonly string[];
  booleanKeys: readonly string[];
}
export declare function createValidateEnv(
  options: ValidateEnvOptions,
): (config: EnvLike) => EnvLike;
