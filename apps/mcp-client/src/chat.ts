import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { AppContext } from './common/types.js';
import { streamChatTurn } from './common/chat-engine.js';
import { getMcpPromptMessage, type PromptInfo } from './common/prompts.js';
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
const HINT_COLOR = 33;

function printPromptList(prompts: PromptInfo[]): void {
  if (prompts.length === 0) {
    console.log(color('No MCP prompts available.', HINT_COLOR));
    return;
  }

  console.log(color('\nMCP prompts:', HINT_COLOR, STYLE_BOLD));
  for (const prompt of prompts) {
    const title = prompt.title ? ` — ${prompt.title}` : '';
    console.log(`  ${color(prompt.name, TOOL_COLOR, STYLE_BOLD)}${title}`);
    if (prompt.description) {
      console.log(`    ${prompt.description}`);
    }
    const args = prompt.arguments ?? [];
    if (args.length > 0) {
      const argList = args
        .map((arg) => (arg.required === false ? `${arg.name}?` : arg.name))
        .join(', ');
      console.log(`    args: ${argList}`);
    }
  }
  console.log(
    color(
      '\nUse "/prompt <name>" to fill arguments and inject into chat.\n',
      HINT_COLOR,
    ),
  );
}

async function collectPromptArgs(
  rl: Interface,
  prompt: PromptInfo,
): Promise<Record<string, string> | null> {
  const args: Record<string, string> = {};
  for (const arg of prompt.arguments ?? []) {
    const required = arg.required !== false;
    const hint = arg.description ? ` (${arg.description})` : '';
    const optional = required ? '' : ' [optional]';
    const answer = await rl.question(
      color(`${arg.name}${optional}${hint}: `, USER_COLOR),
    );
    const trimmed = answer.trim();
    if (!trimmed) {
      if (required) {
        console.log(
          color(`"${arg.name}" is required.`, ERROR_COLOR, STYLE_BOLD),
        );
        return null;
      }
      continue;
    }
    args[arg.name] = trimmed;
  }
  return args;
}

export async function runChat({
  transport,
  mcpClient,
  prompts,
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

  const runTurn = async (userInput: string): Promise<void> => {
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
            const toolName = event.name ? ` ${event.name}` : '';
            process.stdout.write(
              color(`${label}${toolName} ${event.text}\n`, TOOL_COLOR),
            );
            break;
          }
          case 'prompt_cache':
            break;
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
  };

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

      const trimmed = userInput.trim();
      if (!trimmed) {
        continue;
      }

      if (trimmed === '/prompts' || trimmed === '/prompt') {
        printPromptList(prompts);
        continue;
      }

      if (trimmed.startsWith('/prompt ')) {
        const promptName = trimmed.slice('/prompt '.length).trim();
        const prompt = prompts.find((item) => item.name === promptName);
        if (!prompt) {
          console.log(
            color(
              `Unknown prompt "${promptName}". Use /prompts to list.`,
              ERROR_COLOR,
            ),
          );
          continue;
        }
        if (!mcpClient) {
          console.log(color('MCP server is not connected.', ERROR_COLOR));
          continue;
        }

        const args = await collectPromptArgs(rl, prompt);
        if (!args) {
          continue;
        }

        try {
          const { message } = await getMcpPromptMessage(
            mcpClient,
            prompt.name,
            args,
          );
          console.log(color('\n[injected prompt]', HINT_COLOR, STYLE_ITALIC));
          console.log(color(message, HINT_COLOR, STYLE_ITALIC));
          console.log('');
          await runTurn(message);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            color('Error:', ERROR_COLOR, STYLE_BOLD),
            color(message, ERROR_DESCRIPTION_COLOR),
          );
        }
        continue;
      }

      await runTurn(userInput);
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    rl.close();
    await transport?.close();
  }
}
