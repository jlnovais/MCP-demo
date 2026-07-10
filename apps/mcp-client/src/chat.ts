import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { AppContext } from './common/types.js';
import { streamChatTurn } from './common/chat-engine.js';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { color } from './io.js';

const USER_COLOR = 34;
const CLAUDE_NAME_COLOR = 32;
const RESPONSE_COLOR = 36;
const ERROR_COLOR = 31;
const ERROR_DESCRIPTION_COLOR = 35;
const TOOL_COLOR = 32;
const THINKING_COLOR = 35;
const STYLE_ITALIC = 3;
const STYLE_BOLD = 1;

export async function runChat({
  transport,
  ...ctx
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

      let thinkingStarted = false;
      let textStarted = false;

      try {
        await streamChatTurn(ctx, messages, userInput, (event) => {
          switch (event.type) {
            case 'thinking':
              if (!thinkingStarted) {
                process.stdout.write(
                  color('\n[thinking] ', THINKING_COLOR, STYLE_ITALIC),
                );
                thinkingStarted = true;
              }
              process.stdout.write(
                color(event.delta, THINKING_COLOR, STYLE_ITALIC),
              );
              break;
            case 'text':
              if (!textStarted) {
                if (thinkingStarted) {
                  process.stdout.write('\n');
                }
                process.stdout.write(
                  color('\nClaude: ', CLAUDE_NAME_COLOR, STYLE_BOLD),
                );
                textStarted = true;
              }
              process.stdout.write(color(event.delta, RESPONSE_COLOR));
              break;
            case 'tool_use':
              process.stdout.write(
                color(
                  `\n[calling tool: ${event.name} ${JSON.stringify(event.input)}]\n`,
                  TOOL_COLOR,
                  STYLE_ITALIC,
                ),
              );
              break;
            case 'tool_result': {
              const label = event.isError ? '[tool error]' : '[tool result]';
              process.stdout.write(
                color(`${label} ${event.text}\n`, TOOL_COLOR),
              );
              break;
            }
            case 'done':
              if (textStarted) {
                process.stdout.write('\n\n');
              }
              break;
            case 'error':
              break;
          }
        });
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
