import { useState } from 'react';
import type { DisplayMessage, MessageBlock } from '../types';
import { MarkdownContent } from './MarkdownContent';
import './MessageBubble.css';

type MessageBubbleProps = {
  message: DisplayMessage;
};

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="thinking-block">
      <button
        type="button"
        className="thinking-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>Thinking</span>
      </button>
      {open ? <div className="thinking-content">{text}</div> : null}
    </div>
  );
}

function BlockView({
  block,
  role,
  streaming,
}: {
  block: MessageBlock;
  role: DisplayMessage['role'];
  streaming?: boolean;
}) {
  switch (block.type) {
    case 'thinking':
      return <ThinkingBlock text={block.text} />;
    case 'tool_use':
      return (
        <div className="tool-badge">
          <div className="tool-badge-header">
            <span>⚙</span>
            <span>{block.name}</span>
          </div>
          <pre>{JSON.stringify(block.input, null, 2)}</pre>
        </div>
      );
    case 'tool_result':
      return (
        <div className={`tool-result ${block.isError ? 'error' : ''}`}>
          <strong>{block.isError ? 'Tool error' : 'Tool result'}</strong>
          <div>{block.text}</div>
        </div>
      );
    case 'text':
      return (
        <div
          className={`message-bubble ${streaming ? 'streaming-cursor' : ''}`}
        >
          {role === 'assistant' ? (
            <MarkdownContent>{block.text}</MarkdownContent>
          ) : (
            block.text
          )}
        </div>
      );
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const lastBlock = message.blocks.at(-1);
  const isStreamingText =
    message.streaming && lastBlock?.type === 'text';

  return (
    <div className={`message ${message.role}`}>
      <div className="message-role">
        {message.role === 'user' ? 'You' : 'Claude'}
      </div>

      <div className="message-blocks">
        {message.blocks.map((block, index) => (
          <BlockView
            key={`${message.id}-${index}`}
            block={block}
            role={message.role}
            streaming={
              isStreamingText && index === message.blocks.length - 1
            }
          />
        ))}
      </div>
    </div>
  );
}
