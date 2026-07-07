import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DisplayMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import './ChatWindow.css';

type ChatWindowProps = {
  messages: DisplayMessage[];
  isStreaming: boolean;
  onSend: (message: string) => void;
};

export function ChatWindow({ messages, isStreaming, onSend }: ChatWindowProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) {
      return;
    }
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
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
