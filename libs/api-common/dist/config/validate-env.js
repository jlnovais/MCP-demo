"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEnvBoolean = parseEnvBoolean;
exports.createValidateEnv = createValidateEnv;
function emptyToUndefined(value) {
    if (value === '')
        return undefined;
    return value;
}
function toOptionalNumber(value) {
    const v = emptyToUndefined(value);
    if (v === undefined || v === null)
        return undefined;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : undefined;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function toOptionalBoolean(value) {
    const v = emptyToUndefined(value);
    if (v === undefined || v === null)
        return undefined;
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'string')
        return v.toLowerCase() === 'true';
    return Boolean(v);
}
function parseEnvBoolean(value, defaultValue) {
    const v = emptyToUndefined(value);
    if (v === undefined || v === null)
        return defaultValue;
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'string') {
        const normalized = v.trim().toLowerCase();
        if (normalized === 'false' || normalized === '0')
            return false;
        return true;
    }
    return Boolean(v);
}
function createValidateEnv(options) {
    const { stringKeys, numberKeys, booleanKeys } = options;
    return function validateEnv(config) {
        const next = { ...config };
        for (const key of stringKeys)
            next[key] = emptyToUndefined(next[key]);
        for (const key of numberKeys)
            next[key] = toOptionalNumber(next[key]);
        for (const key of booleanKeys)
            next[key] = toOptionalBoolean(next[key]);
        return next;
    };
}
//# sourceMappingURL=validate-env.js.map