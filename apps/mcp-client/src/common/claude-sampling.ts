export type ClaudeSamplingParams = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
};

export const SAMPLING_PRESET_IDS = [
  'precise',
  'creative',
  'think_hard',
] as const;

export type SamplingPresetId = (typeof SAMPLING_PRESET_IDS)[number];

export type SamplingPresetInfo = {
  id: SamplingPresetId;
  label: string;
  description: string;
  /** Shown in the toolbar tip; explains API trade-offs. */
  hint: string;
};

export const SAMPLING_PRESETS: Record<SamplingPresetId, SamplingPresetInfo> = {
  precise: {
    id: 'precise',
    label: 'Precise',
    description: 'Temperature 0 — more deterministic answers',
    hint: 'Best for facts, IDs, and tool-driven wallet steps.',
  },
  creative: {
    id: 'creative',
    label: 'Creative',
    description: 'Temperature 1 — more varied wording',
    hint: 'Best for brainstorming or varied phrasing (still in-scope).',
  },
  think_hard: {
    id: 'think_hard',
    label: 'Think hard',
    description: 'Extended thinking on (API fixes temperature at 1)',
    hint: 'Uses the thinking budget; sampling temperature is ignored.',
  },
};

export const DEFAULT_SAMPLING_PRESET: SamplingPresetId = 'precise';

export function isSamplingPresetId(value: unknown): value is SamplingPresetId {
  return (
    typeof value === 'string' &&
    (SAMPLING_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function listSamplingPresets(): SamplingPresetInfo[] {
  return SAMPLING_PRESET_IDS.map((id) => SAMPLING_PRESETS[id]);
}

function parseOptionalNumber(
  name: string,
  value: string | undefined,
): number | undefined {
  if (value == null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}: must be a number`);
  }
  return parsed;
}

export function resolveClaudeSamplingParams(options: {
  thinkingBudget: number | undefined;
  onWarning?: (message: string) => void;
}): ClaudeSamplingParams {
  const temperature = parseOptionalNumber(
    'CLAUDE_TEMPERATURE',
    process.env.CLAUDE_TEMPERATURE,
  );
  const topP = parseOptionalNumber('CLAUDE_TOP_P', process.env.CLAUDE_TOP_P);
  const topK = parseOptionalNumber('CLAUDE_TOP_K', process.env.CLAUDE_TOP_K);
  const warn = options.onWarning ?? ((message) => console.warn(message));

  if (options.thinkingBudget) {
    if (topP !== undefined) {
      warn('CLAUDE_TOP_P is ignored when extended thinking is enabled.');
    }
    if (topK !== undefined) {
      warn('CLAUDE_TOP_K is ignored when extended thinking is enabled.');
    }
    if (temperature !== undefined && temperature !== 1) {
      warn(
        `CLAUDE_TEMPERATURE=${temperature} is ignored when extended thinking is enabled (API requires temperature=1).`,
      );
    }
    return {};
  }

  const params: ClaudeSamplingParams = {};

  // Claude 4.x models reject requests that include both temperature and top_p.
  let effectiveTopP = topP;
  if (temperature !== undefined && topP !== undefined) {
    warn(
      'CLAUDE_TEMPERATURE and CLAUDE_TOP_P are both set; Claude 4.x allows only one — using temperature and ignoring top_p.',
    );
    effectiveTopP = undefined;
  }

  if (temperature !== undefined) {
    if (temperature < 0 || temperature > 1) {
      throw new Error('CLAUDE_TEMPERATURE must be between 0 and 1');
    }
    params.temperature = temperature;
  }

  if (effectiveTopP !== undefined) {
    if (effectiveTopP <= 0 || effectiveTopP > 1) {
      throw new Error('CLAUDE_TOP_P must be greater than 0 and at most 1');
    }
    params.top_p = effectiveTopP;
  }

  if (topK !== undefined) {
    if (!Number.isInteger(topK) || topK <= 0) {
      throw new Error('CLAUDE_TOP_K must be a positive integer');
    }
    params.top_k = topK;
  }

  return params;
}

export type ResolvedTurnSampling = {
  thinkingEnabled: boolean;
  samplingParams: ClaudeSamplingParams;
};

/**
 * Resolve per-turn sampling + thinking from a UI preset, or fall back to
 * env-based params and an optional thinking toggle (CLI / legacy).
 */
export function resolveTurnSampling(options: {
  preset?: SamplingPresetId;
  /** Used only when `preset` is omitted (CLI / env path). */
  thinkingEnabled?: boolean;
  thinkingBudget: number | undefined;
  envSamplingParams: ClaudeSamplingParams;
}): ResolvedTurnSampling {
  if (options.preset === 'precise') {
    return {
      thinkingEnabled: false,
      samplingParams: { temperature: 0 },
    };
  }

  if (options.preset === 'creative') {
    return {
      thinkingEnabled: false,
      samplingParams: { temperature: 1 },
    };
  }

  if (options.preset === 'think_hard') {
    return {
      thinkingEnabled: true,
      samplingParams: {},
    };
  }

  const thinkingEnabled =
    options.thinkingEnabled ??
    (options.thinkingBudget !== undefined && options.thinkingBudget > 0);

  if (thinkingEnabled) {
    return {
      thinkingEnabled: true,
      samplingParams: {},
    };
  }

  return {
    thinkingEnabled: false,
    samplingParams: options.envSamplingParams,
  };
}
