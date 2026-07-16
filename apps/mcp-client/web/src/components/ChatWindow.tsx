import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DisplayMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import './ChatWindow.css';

type ChatWindowProps = {
  messages: DisplayMessage[];
  isStreaming: boolean;
  promptCacheTtl?: '5m' | '1h';
  onSend: (message: string) => void;
};

export function ChatWindow({
  messages,
  isStreaming,
  promptCacheTtl,
  onSend,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentHistory = useRef<string[]>([]);
  const historyIndex = useRef<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) {
      return;
    }
    onSend(trimmed);
    sentHistory.current.push(trimmed);
    historyIndex.current = null;
    setInput('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
      return;
    }

    const history = sentHistory.current;
    const isNavigating = historyIndex.current !== null;

    if (event.key === 'ArrowUp' && history.length > 0 && (input === '' || isNavigating)) {
      event.preventDefault();
      const nextIndex = isNavigating ? Math.max(0, historyIndex.current! - 1) : history.length - 1;
      historyIndex.current = nextIndex;
      setInput(history[nextIndex]);
      return;
    }

    if (event.key === 'ArrowDown' && isNavigating) {
      event.preventDefault();
      const nextIndex = historyIndex.current! + 1;
      if (nextIndex >= history.length) {
        historyIndex.current = null;
        setInput('');
      } else {
        historyIndex.current = nextIndex;
        setInput(history[nextIndex]);
      }
    }
  };

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            promptCacheTtl={promptCacheTtl}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              historyIndex.current = null;
              setInput(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about wallets, payments, or knowledge base…"
            disabled={isStreaming}
            rows={1}
          />
          <button type="submit" className="send-btn" disabled={isStreaming || !input.trim()}>
            {isStreaming ? '…' : 'Send'}
          </button>
        </form>
        <p className="chat-hint">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
