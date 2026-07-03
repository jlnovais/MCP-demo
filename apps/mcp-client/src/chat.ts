import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type {
  BetaMessageParam,
  BetaToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { AppContext } from './bootstrap.js';
import { color } from './io.js';

const USER_COLOR = 34;
const CLAUDE_NAME_COLOR = 32;
const RESPONSE_COLOR = 36;
const ERROR_COLOR = 31;
const ERROR_DESCRIPTION_COLOR = 35;
const TOOL_COLOR = 32;
const THINKING_COLOR = 35;
const TOOL_RESULT_MAX_CHARS = 1000;
const STYLE_ITALIC = 3;
const STYLE_BOLD = 1;
//const STYLE_UNDERLINE = 4;

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

function printToolResults(message: BetaMessageParam): void {
  if (message.role !== 'user' || typeof message.content === 'string') {
    return;
  }
  for (const block of message.content) {
    if (block.type !== 'tool_result') {
      continue;
    }
    let text = stringifyToolResultContent(block.content);
    if (text.length > TOOL_RESULT_MAX_CHARS) {
      text = `${text.slice(0, TOOL_RESULT_MAX_CHARS)}… (truncated)`;
    }
    const label = block.is_error ? '[tool error]' : '[tool result]';
    process.stdout.write(color(`${label} ${text}\n`, TOOL_COLOR));
  }
}

export async function runChat({
  anthropic,
  model,
  maxTokens,
  claudeTools,
  transport,
  thinkingBudget,
}: AppContext): Promise<void> {
  const rl = createInterface({ input, output });
  const messages: BetaMessageParam[] = [];
  let exiting = false;

  const onSigint = (): void => {
    if (exiting) {
      process.exit(130);
    }
    exiting = true;
    console.log('');
    rl.close();
  };

  process.on('SIGINT', onSigint);

  try {
    while (!exiting) {
      let userInput: string;
      try {
        userInput = await rl.question(color('You: ', USER_COLOR, STYLE_BOLD));
      } catch {
        break;
      }

      if (userInput === 'exit') {
        break;
      }

      if (!userInput.trim()) {
        continue;
      }

      messages.push({ role: 'user', content: userInput });

      const runner = anthropic.beta.messages.toolRunner({
        model,
        max_tokens: maxTokens,
        messages,
        tools: claudeTools,
        stream: true,
        ...(thinkingBudget
          ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget } }
          : {}),
      });

      try {
        let printedMessages = runner.params.messages.length;
        for await (const stream of runner) {
          const currentMessages = runner.params.messages;
          for (let i = printedMessages; i < currentMessages.length; i++) {
            printToolResults(currentMessages[i]);
          }
          printedMessages = currentMessages.length;

          let started = false;
          let thinkingStarted = false;
          stream.on('thinking', (delta) => {
            if (!thinkingStarted) {
              process.stdout.write(
                color('\n[thinking] ', THINKING_COLOR, STYLE_ITALIC),
              );
              thinkingStarted = true;
            }
            process.stdout.write(color(delta, THINKING_COLOR, STYLE_ITALIC));
          });
          stream.on('text', (delta) => {
            if (!started) {
              if (thinkingStarted) {
                process.stdout.write('\n');
              }
              process.stdout.write(
                color('\nClaude: ', CLAUDE_NAME_COLOR, STYLE_BOLD),
              );
              started = true;
            }
            process.stdout.write(color(delta, RESPONSE_COLOR));
          });
          stream.on('contentBlock', (block) => {
            if (block.type === 'tool_use') {
              const args = JSON.stringify(block.input);
              process.stdout.write(
                color(
                  `\n[calling tool: ${block.name} ${args}]\n`,
                  TOOL_COLOR,
                  STYLE_ITALIC,
                ),
              );
            }
          });
          await stream.done();
          if (started) {
            process.stdout.write('\n\n');
          }
        }
        const finalMessages = runner.params.messages;
        for (let i = printedMessages; i < finalMessages.length; i++) {
          printToolResults(finalMessages[i]);
        }
        messages.length = 0;
        messages.push(...finalMessages);
      } catch (error) {
        messages.pop();
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          color('Error:', ERROR_COLOR, STYLE_BOLD),
          color(message, ERROR_DESCRIPTION_COLOR),
        );
      }
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    rl.close();
    await transport?.close();
  }
}
