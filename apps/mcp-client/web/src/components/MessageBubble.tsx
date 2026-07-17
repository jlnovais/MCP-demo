import { useState } from 'react';
import type { DisplayMessage, MessageBlock, PromptCacheStats } from '../types';
import { MarkdownContent } from './MarkdownContent';
import './MessageBubble.css';

type MessageBubbleProps = {
  message: DisplayMessage;
  promptCacheTtl?: '5m' | '1h';
};

function formatCacheStats(stats: PromptCacheStats): string {
  return `cache step=${stats.step} ${stats.status} read=${stats.read} write=${stats.write} in=${stats.input} out=${stats.output}`;
}

const CACHE_READ_MULT = 0.1;
const CACHE_WRITE_MULT = { '5m': 1.25, '1h': 2 } as const;

const CACHE_HELP_ITEMS = [
  {
    term: 'step',
    text: 'Which model call in this turn (1 = first reply; 2+ if tools ran and Claude called again).',
  },
  {
    term: 'HIT / WRITE / MISS',
    text: 'Cache outcome: HIT = tokens read from cache; WRITE = new cache content written; MISS = neither.',
  },
  {
    term: 'read',
    text: 'Input tokens served from the prompt cache (cheaper / faster).',
  },
  {
    term: 'write',
    text: 'Input tokens newly written into the cache on this call.',
  },
  {
    term: 'in',
    text: 'Non-cached input tokens billed at normal input rates.',
  },
  {
    term: 'out',
    text: 'Tokens Claude generated in the response.',
  },
] as const;

type CacheBilling = {
  off: number;
  on: number;
  savingsPct: number;
};

function promptTokensOff(stats: PromptCacheStats): number {
  return stats.read + stats.write + stats.input;
}

function promptTokensOn(
  stats: PromptCacheStats,
  ttl: '5m' | '1h',
): number {
  return (
    stats.read * CACHE_READ_MULT +
    stats.write * CACHE_WRITE_MULT[ttl] +
    stats.input
  );
}

function cacheBilling(
  statsList: PromptCacheStats[],
  ttl: '5m' | '1h',
): CacheBilling {
  const off = statsList.reduce((sum, stats) => sum + promptTokensOff(stats), 0);
  const on = statsList.reduce((sum, stats) => sum + promptTokensOn(stats, ttl), 0);
  const savingsPct = off === 0 ? 0 : ((on - off) / off) * 100;
  return { off, on, savingsPct };
}

function formatTokenCount(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatSavingsPct(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return '0%';
  }
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function CacheStatsHelp({
  cacheStats,
  promptCacheTtl,
}: {
  cacheStats: PromptCacheStats[];
  promptCacheTtl: '5m' | '1h';
}) {
  const [open, setOpen] = useState(false);
  const billing = cacheBilling(cacheStats, promptCacheTtl);
  const writeMult = CACHE_WRITE_MULT[promptCacheTtl];

  return (
    <div className="cache-stats-help">
      <button
        type="button"
        className="cache-stats-help-btn"
        aria-expanded={open}
        aria-label="Explain cache stats"
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open ? (
        <div className="cache-stats-popover" role="dialog" aria-label="Cache stats legend">
          <div className="cache-stats-popover-header">
            <strong>Prompt cache line</strong>
            <button
              type="button"
              className="cache-stats-popover-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="cache-stats-billing">
            <div className="cache-stats-billing-title">
              Prompt tokens billed ({promptCacheTtl} rates)
            </div>
            {cacheStats.length > 1
              ? cacheStats.map((stats) => {
                  const stepBilling = cacheBilling([stats], promptCacheTtl);
                  return (
                    <div key={stats.step} className="cache-stats-billing-row">
                      <span>step {stats.step}</span>
                      <span>
                        off {formatTokenCount(stepBilling.off)} · on{' '}
                        {formatTokenCount(stepBilling.on)} ·{' '}
                        <span
                          className={
                            stepBilling.savingsPct < 0
                              ? 'cache-savings-down'
                              : stepBilling.savingsPct > 0
                                ? 'cache-savings-up'
                                : undefined
                          }
                        >
                          {formatSavingsPct(stepBilling.savingsPct)} tokens
                        </span>
                      </span>
                    </div>
                  );
                })
              : null}
            <div className="cache-stats-billing-row total">
              <span>cache off</span>
              <span>{formatTokenCount(billing.off)}</span>
            </div>
            <div className="cache-stats-billing-row total">
              <span>cache on</span>
              <span>{formatTokenCount(billing.on)}</span>
            </div>
            <div className="cache-stats-billing-row total">
              <span>savings</span>
              <span
                className={
                  billing.savingsPct < 0
                    ? 'cache-savings-down'
                    : billing.savingsPct > 0
                      ? 'cache-savings-up'
                      : undefined
                }
              >
                {formatSavingsPct(billing.savingsPct)} tokens
              </span>
            </div>
            <p className="cache-stats-billing-note">
              Equivalents vs base input (read {CACHE_READ_MULT}×, write {writeMult}
              ×). Output is the same either way.
            </p>
          </div>

          <dl>
            {CACHE_HELP_ITEMS.map((item) => (
              <div key={item.term} className="cache-stats-popover-item">
                <dt>{item.term}</dt>
                <dd>{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

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

export function MessageBubble({
  message,
  promptCacheTtl = '5m',
}: MessageBubbleProps) {
  const lastBlock = message.blocks.at(-1);
  const isStreamingText =
    message.streaming && lastBlock?.type === 'text';
  const cacheStats = message.cacheStats;
  const showCacheStats =
    message.role === 'assistant' &&
    !message.streaming &&
    cacheStats !== undefined &&
    cacheStats.length > 0;

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

      {showCacheStats ? (
        <div className="cache-stats">
          <div className="cache-stats-lines">
            {cacheStats.map((stats) => (
              <div key={stats.step}>{formatCacheStats(stats)}</div>
            ))}
          </div>
          <CacheStatsHelp
            cacheStats={cacheStats}
            promptCacheTtl={promptCacheTtl}
          />
        </div>
      ) : null}
    </div>
  );
}
