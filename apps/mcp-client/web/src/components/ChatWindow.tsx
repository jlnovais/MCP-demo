import { memo, useEffect, useRef } from 'react';
import type { DisplayMessage, PromptInfo } from '../types';
import { ChatInputArea } from './ChatInputArea';
import { MessageBubble } from './MessageBubble';
import './ChatWindow.css';

type ChatWindowProps = {
  messages: DisplayMessage[];
  isStreaming: boolean;
  prompts?: PromptInfo[];
  promptCacheTtl?: '5m' | '1h';
  thinkingEnabled: boolean;
  onThinkingChange: (enabled: boolean) => void;
  onSend: (message: string) => void;
};

const MemoMessageBubble = memo(MessageBubble);

export function ChatWindow({
  messages,
  isStreaming,
  prompts = [],
  promptCacheTtl,
  thinkingEnabled,
  onThinkingChange,
  onSend,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.map((message) => (
          <MemoMessageBubble
            key={message.id}
            message={message}
            promptCacheTtl={promptCacheTtl}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <ChatInputArea
        isStreaming={isStreaming}
        prompts={prompts}
        thinkingEnabled={thinkingEnabled}
        onThinkingChange={onThinkingChange}
        onSend={onSend}
      />
    </div>
  );
}
