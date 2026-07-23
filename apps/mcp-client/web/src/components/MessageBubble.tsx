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

function formatSavingsLabel(savingsPct: number): {
  text: string;
  tone: 'down' | 'up' | 'flat';
} {
  const rounded = Math.round(savingsPct);
  if (rounded === 0) {
    return { text: 'same cost', tone: 'flat' };
  }
  if (rounded < 0) {
    return { text: `saved ${Math.abs(rounded)}%`, tone: 'down' };
  }
  return { text: `cost ${rounded}% more`, tone: 'up' };
}

function savingsClassName(tone: 'down' | 'up' | 'flat'): string | undefined {
  if (tone === 'down') {
    return 'cache-savings-down';
  }
  if (tone === 'up') {
    return 'cache-savings-up';
  }
  return undefined;
}

function CacheLegendPopover({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="cache-stats-popover cache-stats-popover-legend"
      role="dialog"
      aria-label="Cache stats legend"
    >
      <div className="cache-stats-popover-header">
        <strong className="cache-stats-popover-title-legend">
          Prompt cache line
        </strong>
        <button
          type="button"
          className="cache-stats-popover-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
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
  );
}

function CacheCostStepCard({
  stats,
  promptCacheTtl,
}: {
  stats: PromptCacheStats;
  promptCacheTtl: '5m' | '1h';
}) {
  const billing = cacheBilling([stats], promptCacheTtl);
  const writeMult = CACHE_WRITE_MULT[promptCacheTtl];
  const savings = formatSavingsLabel(billing.savingsPct);

  return (
    <div className="cache-cost-step">
      <div className="cache-cost-step-header">
        <span>API call {stats.step}</span>
        <span className={savingsClassName(savings.tone)}>{savings.text}</span>
      </div>
      <div className="cache-cost-step-rows">
        <div className="cache-stats-billing-row">
          <span>Without cache</span>
          <span>{formatTokenCount(billing.off)} tokens</span>
        </div>
        <div className="cache-stats-billing-row">
          <span>With cache (what you paid)</span>
          <span>{formatTokenCount(billing.on)} tokens</span>
        </div>
      </div>
      <p className="cache-cost-step-math">
        With cache = read {formatTokenCount(stats.read)} × {CACHE_READ_MULT} +
        write {formatTokenCount(stats.write)} × {writeMult} + in{' '}
        {formatTokenCount(stats.input)}
      </p>
    </div>
  );
}

function CacheCostPopover({
  open,
  onClose,
  cacheStats,
  promptCacheTtl,
}: {
  open: boolean;
  onClose: () => void;
  cacheStats: PromptCacheStats[];
  promptCacheTtl: '5m' | '1h';
}) {
  if (!open) {
    return null;
  }

  const billing = cacheBilling(cacheStats, promptCacheTtl);
  const writeMult = CACHE_WRITE_MULT[promptCacheTtl];
  const savings = formatSavingsLabel(billing.savingsPct);
  const multiStep = cacheStats.length > 1;

  return (
    <div
      className="cache-stats-popover cache-stats-popover-cost"
      role="dialog"
      aria-label="Cache token costs"
    >
      <div className="cache-stats-popover-header">
        <strong className="cache-stats-popover-title-cost">
          Prompt token cost
        </strong>
        <button
          type="button"
          className="cache-stats-popover-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <p className="cache-cost-intro">
        Compare how many prompt tokens this reply would cost with cache off vs
        on. Numbers are billed equivalents at {promptCacheTtl} rates (read{' '}
        {CACHE_READ_MULT}×, write {writeMult}×). Output tokens are unchanged.
      </p>

      <div className="cache-stats-billing">
        {cacheStats.map((stats) => (
          <CacheCostStepCard
            key={stats.step}
            stats={stats}
            promptCacheTtl={promptCacheTtl}
          />
        ))}

        {multiStep ? (
          <div className="cache-cost-total">
            <div className="cache-cost-step-header">
              <span>Whole reply</span>
              <span className={savingsClassName(savings.tone)}>
                {savings.text}
              </span>
            </div>
            <div className="cache-stats-billing-row total">
              <span>Without cache</span>
              <span>{formatTokenCount(billing.off)} tokens</span>
            </div>
            <div className="cache-stats-billing-row total">
              <span>With cache (what you paid)</span>
              <span>{formatTokenCount(billing.on)} tokens</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CacheStatsHelp({
  cacheStats,
  promptCacheTtl,
}: {
  cacheStats: PromptCacheStats[];
  promptCacheTtl: '5m' | '1h';
}) {
  const [openPanel, setOpenPanel] = useState<'legend' | 'cost' | null>(null);

  const toggle = (panel: 'legend' | 'cost') => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  return (
    <div className="cache-stats-actions">
      <div className="cache-stats-help">
        <button
          type="button"
          className="cache-stats-help-btn cache-stats-help-btn-legend"
          aria-expanded={openPanel === 'legend'}
          aria-label="Explain cache stats"
          onClick={() => toggle('legend')}
        >
          ?
        </button>
        <CacheLegendPopover
          open={openPanel === 'legend'}
          onClose={() => setOpenPanel(null)}
        />
      </div>

      <div className="cache-stats-help">
        <button
          type="button"
          className="cache-stats-help-btn cache-stats-help-btn-cost"
          aria-expanded={openPanel === 'cost'}
          aria-label="Show cache token costs"
          onClick={() => toggle('cost')}
        >
          $
        </button>
        <CacheCostPopover
          open={openPanel === 'cost'}
          onClose={() => setOpenPanel(null)}
          cacheStats={cacheStats}
          promptCacheTtl={promptCacheTtl}
        />
      </div>
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
