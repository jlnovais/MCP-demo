import type { ChatStreamEvent, MessageBlock } from './types';

function appendToLastBlock(
  blocks: MessageBlock[],
  blockType: 'thinking' | 'text',
  delta: string,
): MessageBlock[] {
  const last = blocks.at(-1);
  if (last?.type === blockType) {
    return [
      ...blocks.slice(0, -1),
      { ...last, text: last.text + delta },
    ];
  }
  return [...blocks, { type: blockType, text: delta }];
}

export function applyStreamEvent(
  blocks: MessageBlock[],
  event: ChatStreamEvent,
): MessageBlock[] {
  switch (event.type) {
    case 'thinking':
      return appendToLastBlock(blocks, 'thinking', event.delta);
    case 'text':
      return appendToLastBlock(blocks, 'text', event.delta);
    case 'tool_use':
      return [
        ...blocks,
        { type: 'tool_use', name: event.name, input: event.input },
      ];
    case 'tool_result':
      return [
        ...blocks,
        { type: 'tool_result', text: event.text, isError: event.isError },
      ];
    default:
      return blocks;
  }
}
