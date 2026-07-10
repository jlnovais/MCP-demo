import type {
  BetaMessageParam,
  BetaToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { randomUUID } from 'node:crypto';
import type {
  AppContext,
  ChatStreamEvent,
  DisplayMessage,
  MessageBlock,
} from './types.js';

const TOOL_RESULT_MAX_CHARS = 1000;

type ChatEngineContext = Pick<
  AppContext,
  'anthropic' | 'model' | 'maxTokens' | 'claudeTools' | 'thinkingBudget'
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

function* toolResultEvents(
  message: BetaMessageParam,
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
    };
  }
}

export async function streamChatTurn(
  ctx: ChatEngineContext,
  messages: BetaMessageParam[],
  userInput: string,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  messages.push({ role: 'user', content: userInput });

  const runner = ctx.anthropic.beta.messages.toolRunner({
    model: ctx.model,
    max_tokens: ctx.maxTokens,
    messages,
    tools: ctx.claudeTools,
    stream: true,
    ...(ctx.thinkingBudget
      ? { thinking: { type: 'enabled', budget_tokens: ctx.thinkingBudget } }
      : {}),
  });

  let printedMessages = runner.params.messages.length;

  for await (const stream of runner) {
    const currentMessages = runner.params.messages;
    for (let i = printedMessages; i < currentMessages.length; i++) {
      for (const event of toolResultEvents(currentMessages[i])) {
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
  }

  const finalMessages = runner.params.messages;
  for (let i = printedMessages; i < finalMessages.length; i++) {
    for (const event of toolResultEvents(finalMessages[i])) {
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
        pushToolResultBlocks(blocks, current.content);
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
