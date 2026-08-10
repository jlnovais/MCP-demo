import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  PromptInfo,
  ResourceInfo,
  SamplingPresetId,
  SamplingPresetInfo,
} from '../types';
import { PromptPicker } from './PromptPicker';
import { ResourcePicker } from './ResourcePicker';

type ChatInputAreaProps = {
  isStreaming: boolean;
  prompts: PromptInfo[];
  resources: ResourceInfo[];
  samplingPresets: SamplingPresetInfo[];
  samplingPreset: SamplingPresetId;
  onSamplingPresetChange: (preset: SamplingPresetId) => void;
  onSend: (message: string) => void;
};

export function ChatInputArea({
  isStreaming,
  prompts,
  resources,
  samplingPresets,
  samplingPreset,
  onSamplingPresetChange,
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

  const activePreset =
    samplingPresets.find((preset) => preset.id === samplingPreset) ??
    samplingPresets[0];

  return (
    <div className="chat-input-area">
      <div className="chat-input-form">
        <PromptPicker
          prompts={prompts}
          disabled={isStreaming}
          onInject={onSend}
        />
        <ResourcePicker
          resources={resources}
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
            {samplingPresets.length > 0 ? (
              <div
                className="sampling-preset-group"
                role="group"
                aria-label="Sampling preset"
              >
                {samplingPresets.map((preset) => {
                  const selected = preset.id === samplingPreset;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`sampling-preset-btn${selected ? ' is-on' : ''}`}
                      aria-pressed={selected}
                      disabled={isStreaming}
                      title={preset.description}
                      onClick={() => onSamplingPresetChange(preset.id)}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {activePreset ? (
              <span className="sampling-preset-hint">{activePreset.hint}</span>
            ) : null}
          </div>
        </div>
      </div>
      <p className="chat-hint">
        Enter to send · Shift+Enter for new line
        {prompts.length > 0 ? ' · Prompts for MCP templates' : ''}
        {resources.length > 0 ? ' · Resources for knowledge docs' : ''}
        {samplingPresets.length > 0
          ? ' · Precise / Creative / Think hard to compare sampling'
          : ''}
      </p>
    </div>
  );
}
