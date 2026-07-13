export type ClaudeSamplingParams = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
};

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
