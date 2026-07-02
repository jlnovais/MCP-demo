import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { AppContext } from './bootstrap.js';
import { color, printAssistantMessage } from './io.js';

const USER_COLOR = 94;
const RESPONSE_COLOR = 37;
const ERROR_COLOR = 31;

export async function runChat({
  anthropic,
  model,
  claudeTools,
  transport,
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
        userInput = await rl.question(color('You: ', USER_COLOR));
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
        max_tokens: 4096,
        messages,
        tools: claudeTools,
      });

      try {
        const finalMessage = await runner.runUntilDone();
        messages.length = 0;
        messages.push(...runner.params.messages);
        printAssistantMessage(finalMessage, RESPONSE_COLOR);
      } catch (error) {
        messages.pop();
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          color('Error:', ERROR_COLOR),
          color(message, ERROR_COLOR),
        );
      }
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    rl.close();
    await transport.close();
  }
}
