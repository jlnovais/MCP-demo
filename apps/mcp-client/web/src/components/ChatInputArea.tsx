import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PromptInfo } from '../types';
import { PromptPicker } from './PromptPicker';

type ChatInputAreaProps = {
  isStreaming: boolean;
  prompts: PromptInfo[];
  thinkingEnabled: boolean;
  onThinkingChange: (enabled: boolean) => void;
  onSend: (message: string) => void;
};

function ThinkingIcon() {
  return (
    <svg
      className="thinking-toggle-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 17.5c0 1 .8 1.5 2.5 1.5s2.5-.5 2.5-1.5" />
      <path d="M8 14.5c-1.8-1-3-2.8-3-5a5 5 0 0 1 10 0c0 2.2-1.2 4-3 5" />
      <path d="M10 14.5h4" />
      <path d="M12 2v1.5" />
      <path d="M5.2 5.2l1.1 1.1" />
      <path d="M18.8 5.2l-1.1 1.1" />
    </svg>
  );
}

export function ChatInputArea({
  isStreaming,
  prompts,
  thinkingEnabled,
  onThinkingChange,
  onSend,
}: ChatInputAreaProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentHistory = useRef<string[]>([]);
  const historyIndex = useRef<number | null>(null);

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

    if (
      event.key === 'ArrowUp' &&
      history.length > 0 &&
      (input === '' || isNavigating)
    ) {
      event.preventDefault();
      const nextIndex = isNavigating
        ? Math.max(0, historyIndex.current! - 1)
        : history.length - 1;
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
    <div className="chat-input-area">
      <div className="chat-input-form">
        <PromptPicker
          prompts={prompts}
          disabled={isStreaming}
          onInject={onSend}
        />
        <div className="chat-input-main">
          <form className="chat-input-compose" onSubmit={handleSubmit}>
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
            <button
              type="submit"
              className="send-btn"
              disabled={isStreaming || !input.trim()}
            >
              {isStreaming ? '…' : 'Send'}
            </button>
          </form>
          <div className="chat-input-toolbar">
            <button
              type="button"
              className={`extended-thinking-btn${thinkingEnabled ? ' is-on' : ''}`}
              aria-pressed={thinkingEnabled}
              disabled={isStreaming}
              title={
                thinkingEnabled
                  ? 'Extended thinking on — click to turn off'
                  : 'Extended thinking off — click to turn on'
              }
              onClick={() => onThinkingChange(!thinkingEnabled)}
            >
              <ThinkingIcon />
              <span>Thinking</span>
              <span className="extended-thinking-state">
                {thinkingEnabled ? 'On' : 'Off'}
              </span>
            </button>
          </div>
        </div>
      </div>
      <p className="chat-hint">
        Enter to send · Shift+Enter for new line
        {prompts.length > 0 ? ' · Prompts for MCP templates' : ''}
      </p>
    </div>
  );
}
