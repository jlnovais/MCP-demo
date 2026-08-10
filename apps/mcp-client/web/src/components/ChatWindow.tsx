import { memo, useEffect, useRef } from 'react';
import type {
  DisplayMessage,
  PromptInfo,
  ResourceInfo,
  SamplingPresetId,
  SamplingPresetInfo,
} from '../types';
import { ChatInputArea } from './ChatInputArea';
import { MessageBubble } from './MessageBubble';
import './ChatWindow.css';

type ChatWindowProps = {
  messages: DisplayMessage[];
  isStreaming: boolean;
  prompts?: PromptInfo[];
  resources?: ResourceInfo[];
  promptCacheTtl?: '5m' | '1h';
  samplingPresets: SamplingPresetInfo[];
  samplingPreset: SamplingPresetId;
  onSamplingPresetChange: (preset: SamplingPresetId) => void;
  onSend: (message: string) => void;
};

const MemoMessageBubble = memo(MessageBubble);

export function ChatWindow({
  messages,
  isStreaming,
  prompts = [],
  resources = [],
  promptCacheTtl,
  samplingPresets,
  samplingPreset,
  onSamplingPresetChange,
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
        resources={resources}
        samplingPresets={samplingPresets}
        samplingPreset={samplingPreset}
        onSamplingPresetChange={onSamplingPresetChange}
        onSend={onSend}
      />
    </div>
  );
}
