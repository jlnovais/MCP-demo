import type {
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaUsage,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { randomUUID } from 'node:crypto';
import { OUT_OF_SCOPE_LABEL, REFUSAL_MESSAGE } from './system-prompt.js';
import { buildStructuredOutputStrictAppendix } from './system-prompt.js';
import type {
  AppContext,
  ChatStreamEvent,
  DisplayMessage,
  MessageBlock,
  PromptCacheStats,
} from './types.js';
import {
  resolveTurnSampling,
  type SamplingPresetId,
} from './claude-sampling.js';

const TOOL_RESULT_MAX_CHARS = 1000;
const CLASSIFIER_MAX_TOKENS = 16;

function promptCacheStats(usage: BetaUsage, step: number): PromptCacheStats {
  const read = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  return {
    step,
    status: read > 0 ? 'HIT' : write > 0 ? 'WRITE' : 'MISS',
    read,
    write,
    input: usage.input_tokens,
    output: usage.output_tokens,
  };
}

function logPromptCacheUsage(stats: PromptCacheStats): void {
  console.log(
    `[prompt-cache] step=${stats.step} ${stats.status} read=${stats.read} write=${stats.write} input=${stats.input} output=${stats.output}`,
  );
}

// Phrases (English + Portuguese) an assistant uses when asking the user to
// supply input. When the previous assistant turn ends with a question or one of
// these cues, the next user message is treated as a continuation of an in-scope
// task and the scope classifier is skipped for that turn.
const INPUT_REQUEST_CUES = [
  // English
  'please provide',
  'please enter',
  'please specify',
  'what is the',
  'which ',
  'can you tell me',
  'could you provide',
  'let me know',
  // Portuguese
  'por favor forneça',
  'por favor indique',
  'por favor introduza',
  'pode indicar',
  'pode dizer',
  'poderia indicar',
  'poderia fornecer',
  'qual é o',
  'qual é a',
  'qual o ',
  'qual a ',
  'quais são',
  'diga-me',
  'indique',
];

type ChatEngineContext = Pick<
  AppContext,
  | 'anthropic'
  | 'model'
  | 'maxTokens'
  | 'claudeTools'
  | 'thinkingBudget'
  | 'samplingParams'
  | 'systemPrompt'
  | 'systemPromptFormat'
  | 'classifierPrompt'
  | 'classifierModel'
  | 'classifierEnabled'
  | 'promptCacheEnabled'
  | 'promptCacheTtl'
  | 'structuredOutputStrictDefault'
>;

function stringifyToolResultContent(
  content: BetaToolResultBlockParam['content'],
): string {
  if (content == null) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map((block) => (block.type === 'text' ? block.text : `[${block.type}]`))
    .join('');
}

function truncateToolResult(text: string): string {
  if (text.length <= TOOL_RESULT_MAX_CHARS) {
    return text;
  }
  return `${text.slice(0, TOOL_RESULT_MAX_CHARS)}… (truncated)`;
}

function findToolName(
  messages: BetaMessageParam[],
  toolUseId: string,
): string | undefined {
  for (const message of messages) {
    if (message.role !== 'assistant' || typeof message.content === 'string') {
      continue;
    }
    for (const block of message.content) {
      if (block.type === 'tool_use' && block.id === toolUseId) {
        return block.name;
      }
    }
  }
  return undefined;
}

function* toolResultEvents(
  message: BetaMessageParam,
  messages: BetaMessageParam[],
): Generator<ChatStreamEvent> {
  if (message.role !== 'user' || typeof message.content === 'string') {
    return;
  }
  for (const block of message.content) {
    if (block.type !== 'tool_result') {
      continue;
    }
    yield {
      type: 'tool_result',
      text: truncateToolResult(stringifyToolResultContent(block.content)),
      isError: block.is_error ?? false,
      name: findToolName(messages, block.tool_use_id),
    };
  }
}

function lastAssistantText(messages: BetaMessageParam[]): string | undefined {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant') {
    return undefined;
  }
  if (typeof last.content === 'string') {
    return last.content.trim();
  }
  return last.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
}

function assistantAwaitingReply(messages: BetaMessageParam[]): boolean {
  const text = lastAssistantText(messages);
  if (!text) {
    return false;
  }
  if (text.endsWith('?')) {
    return true;
  }
  const lower = text.toLowerCase();
  return INPUT_REQUEST_CUES.some((cue) => lower.includes(cue));
}

async function isOutOfScope(
  ctx: ChatEngineContext,
  userInput: string,
): Promise<boolean> {
  try {
    const response = await ctx.anthropic.messages.create({
      model: ctx.classifierModel,
      max_tokens: CLASSIFIER_MAX_TOKENS,
      temperature: 0,
      system: ctx.classifierPrompt,
      messages: [{ role: 'user', content: userInput }],
    });

    const verdict = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .toUpperCase();

    return verdict.includes(OUT_OF_SCOPE_LABEL);
  } catch (error) {
    // Fail open: if the classifier is unavailable, fall through to the main
    // turn, which still enforces scope via the system prompt.
    console.warn(
      `Scope classifier failed, allowing request through: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}

export type StreamChatTurnOptions = {
  /**
   * Named sampling preset from the web UI. When set, drives both temperature
   * and whether extended thinking is enabled for this turn.
   */
  preset?: SamplingPresetId;
  /** When set (and no preset), overrides env-based thinking for this turn. */
  thinkingEnabled?: boolean;
  /**
   * When set, overrides STRUCTURED_OUTPUT_STRICT for this turn.
   * Strict mode is for wallet and payment summaries only — not RAG.
   */
  structuredStrict?: boolean;
};

const DEFAULT_THINKING_BUDGET = 1024;

export async function streamChatTurn(
  ctx: ChatEngineContext,
  messages: BetaMessageParam[],
  userInput: string,
  onEvent: (event: ChatStreamEvent) => void,
  options?: StreamChatTurnOptions,
): Promise<void> {
  // Skip the classifier when the assistant just asked the user for input; the
  // reply (e.g. a bare ID or "yes") lacks standalone context and would be
  // misjudged as out of scope. The main turn's system prompt still enforces
  // scope for these follow-ups.
  const skipClassifier = assistantAwaitingReply(messages);

  if (
    ctx.classifierEnabled &&
    !skipClassifier &&
    (await isOutOfScope(ctx, userInput))
  ) {
    messages.push({ role: 'user', content: userInput });
    messages.push({ role: 'assistant', content: REFUSAL_MESSAGE });
    onEvent({ type: 'text', delta: REFUSAL_MESSAGE });
    onEvent({ type: 'done' });
    return;
  }

  messages.push({ role: 'user', content: userInput });

  const { thinkingEnabled, samplingParams } = resolveTurnSampling({
    preset: options?.preset,
    thinkingEnabled: options?.thinkingEnabled,
    thinkingBudget: ctx.thinkingBudget,
    envSamplingParams: ctx.samplingParams,
  });
  const thinkingBudget =
    ctx.thinkingBudget !== undefined && ctx.thinkingBudget > 0
      ? ctx.thinkingBudget
      : DEFAULT_THINKING_BUDGET;
  const thinkingConfig = thinkingEnabled
    ? { type: 'enabled' as const, budget_tokens: thinkingBudget }
    : undefined;

  const structuredStrict =
    options?.structuredStrict ?? ctx.structuredOutputStrictDefault;
  const systemPrompt = structuredStrict
    ? `${ctx.systemPrompt}\n\n${buildStructuredOutputStrictAppendix(ctx.systemPromptFormat)}`
    : ctx.systemPrompt;

  const runner = ctx.anthropic.beta.messages.toolRunner({
    model: ctx.model,
    max_tokens: ctx.maxTokens,
    system: systemPrompt,
    messages,
    tools: ctx.claudeTools,
    stream: true,
    ...(ctx.promptCacheEnabled
      ? {
          cache_control: {
            type: 'ephemeral' as const,
            ...(ctx.promptCacheTtl === '1h' ? { ttl: '1h' as const } : {}),
          },
        }
      : {}),
    ...(thinkingConfig ? { thinking: thinkingConfig } : samplingParams),
  });

  let printedMessages = runner.params.messages.length;
  let apiStep = 0;

  for await (const stream of runner) {
    const currentMessages = runner.params.messages;
    for (let i = printedMessages; i < currentMessages.length; i++) {
      for (const event of toolResultEvents(
        currentMessages[i],
        currentMessages,
      )) {
        onEvent(event);
      }
    }
    printedMessages = currentMessages.length;

    stream.on('thinking', (delta) => {
      onEvent({ type: 'thinking', delta });
    });
    stream.on('text', (delta) => {
      onEvent({ type: 'text', delta });
    });
    stream.on('contentBlock', (block) => {
      if (block.type === 'tool_use') {
        onEvent({
          type: 'tool_use',
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    });
    await stream.done();
    const finalMessage = await stream.finalMessage();
    const cacheStats = promptCacheStats(finalMessage.usage, ++apiStep);
    logPromptCacheUsage(cacheStats);
    onEvent({ type: 'prompt_cache', stats: cacheStats });
  }

  const finalMessages = runner.params.messages;
  for (let i = printedMessages; i < finalMessages.length; i++) {
    for (const event of toolResultEvents(finalMessages[i], finalMessages)) {
      onEvent(event);
    }
  }

  messages.length = 0;
  messages.push(...finalMessages);
  onEvent({ type: 'done' });
}

function pushAssistantBlocks(
  blocks: MessageBlock[],
  content: BetaMessageParam['content'],
): void {
  if (!Array.isArray(content)) {
    return;
  }
  for (const block of content) {
    if (block.type === 'thinking') {
      blocks.push({ type: 'thinking', text: block.thinking });
    } else if (block.type === 'text') {
      blocks.push({ type: 'text', text: block.text });
    } else if (block.type === 'tool_use') {
      blocks.push({
        type: 'tool_use',
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    }
  }
}

function pushToolResultBlocks(
  blocks: MessageBlock[],
  content: BetaMessageParam['content'],
  messages: BetaMessageParam[],
): void {
  if (!Array.isArray(content)) {
    return;
  }
  for (const block of content) {
    if (block.type === 'tool_result') {
      blocks.push({
        type: 'tool_result',
        text: truncateToolResult(stringifyToolResultContent(block.content)),
        isError: block.is_error ?? false,
        name: findToolName(messages, block.tool_use_id),
      });
    }
  }
}

export function betaMessagesToDisplay(
  messages: BetaMessageParam[],
): DisplayMessage[] {
  const display: DisplayMessage[] = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];

    if (message.role === 'user' && typeof message.content === 'string') {
      display.push({
        id: randomUUID(),
        role: 'user',
        blocks: [{ type: 'text', text: message.content }],
        createdAt: new Date().toISOString(),
      });
      index++;
      continue;
    }

    const blocks: MessageBlock[] = [];
    while (index < messages.length) {
      const current = messages[index];
      if (current.role === 'user' && typeof current.content === 'string') {
        break;
      }
      if (current.role === 'assistant') {
        pushAssistantBlocks(blocks, current.content);
      } else if (current.role === 'user') {
        pushToolResultBlocks(blocks, current.content, messages);
      }
      index++;
    }

    if (blocks.length > 0) {
      display.push({
        id: randomUUID(),
        role: 'assistant',
        blocks,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return display;
}

export function deriveSessionTitle(userInput: string): string {
  const trimmed = userInput.trim();
  if (!trimmed) {
    return 'New chat';
  }
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}
