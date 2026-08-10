import { useCallback, useEffect, useState } from 'react';
import {
  createSession,
  deleteSession,
  fetchConfig,
  fetchSession,
  fetchSessions,
  streamChat,
} from './api';
import type {
  DisplayMessage,
  SamplingPresetId,
  ServerConfig,
  SessionSummary,
} from './types';
import { applyStreamEvent } from './block-utils';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import './App.css';

const FALLBACK_PRESETS = [
  {
    id: 'precise' as const,
    label: 'Precise',
    description: 'Temperature 0 — more deterministic answers',
    hint: 'Best for facts, IDs, and tool-driven wallet steps.',
  },
  {
    id: 'creative' as const,
    label: 'Creative',
    description: 'Temperature 1 — more varied wording',
    hint: 'Best for brainstorming or varied phrasing (still in-scope).',
  },
  {
    id: 'think_hard' as const,
    label: 'Think hard',
    description: 'Extended thinking on (API fixes temperature at 1)',
    hint: 'Uses the thinking budget; sampling temperature is ignored.',
  },
];

function createId(): string {
  return crypto.randomUUID();
}

export function App() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetBySession, setPresetBySession] = useState<
    Record<string, SamplingPresetId>
  >({});

  const defaultPreset: SamplingPresetId =
    config?.defaultSamplingPreset ?? 'precise';
  const samplingPresets = config?.samplingPresets?.length
    ? config.samplingPresets
    : FALLBACK_PRESETS;
  const samplingPreset = activeSessionId
    ? (presetBySession[activeSessionId] ?? defaultPreset)
    : defaultPreset;

  const setSamplingPreset = (preset: SamplingPresetId) => {
    if (!activeSessionId) {
      return;
    }
    setPresetBySession((current) => ({
      ...current,
      [activeSessionId]: preset,
    }));
  };

  const loadSessions = useCallback(async () => {
    const list = await fetchSessions();
    setSessions(list);
    return list;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [serverConfig, sessionList] = await Promise.all([
          fetchConfig(),
          fetchSessions(),
        ]);
        setConfig(serverConfig);
        setSessions(sessionList);

        if (sessionList.length > 0) {
          const first = sessionList[0];
          setActiveSessionId(first.id);
          const detail = await fetchSession(first.id);
          setMessages(detail.messages);
        } else {
          const created = await createSession();
          setSessions([created]);
          setActiveSessionId(created.id);
          setMessages([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const selectSession = async (id: string) => {
    if (isStreaming) {
      return;
    }
    setActiveSessionId(id);
    setError(null);
    try {
      const detail = await fetchSession(id);
      setMessages(detail.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleNewChat = async () => {
    if (isStreaming) {
      return;
    }
    setError(null);
    try {
      const created = await createSession();
      setSessions((current) => [created, ...current]);
      setActiveSessionId(created.id);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (isStreaming) {
      return;
    }
    setError(null);
    try {
      await deleteSession(id);
      const remaining = await loadSessions();

      if (activeSessionId === id) {
        if (remaining.length > 0) {
          await selectSession(remaining[0].id);
        } else {
          const created = await createSession();
          setSessions([created]);
          setActiveSessionId(created.id);
          setMessages([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSend = async (text: string) => {
    if (!activeSessionId || isStreaming) {
      return;
    }

    const userMessage: DisplayMessage = {
      id: createId(),
      role: 'user',
      blocks: [{ type: 'text', text }],
      createdAt: new Date().toISOString(),
    };

    const assistantId = createId();
    const assistantMessage: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      blocks: [],
      createdAt: new Date().toISOString(),
      streaming: true,
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setIsStreaming(true);
    setError(null);

    try {
      await streamChat(
        activeSessionId,
        text,
        (event) => {
          if (event.type === 'error') {
            setError(event.message);
            return;
          }

          setMessages((current) =>
            current.map((message) => {
              if (message.id !== assistantId) {
                return message;
              }

              if (event.type === 'done') {
                return { ...message, streaming: false };
              }

              if (event.type === 'prompt_cache') {
                return {
                  ...message,
                  cacheStats: [...(message.cacheStats ?? []), event.stats],
                };
              }

              return {
                ...message,
                blocks: applyStreamEvent(message.blocks, event),
              };
            }),
          );
        },
        { thinking: samplingPreset === 'think_hard', preset: samplingPreset },
      );

      const list = await loadSessions();
      setSessions(list);
    } catch (err) {
      setMessages((current) =>
        current.filter((message) => message.id !== assistantId),
      );
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, streaming: false } : message,
        ),
      );
    }
  };

  const activeSession = sessions.find((session) => session.id === activeSessionId);

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        config={config}
        onNewChat={() => void handleNewChat()}
        onSelectSession={(id) => void selectSession(id)}
        onDeleteSession={(id) => void handleDeleteSession(id)}
      />

      <main className="main">
        <header className="main-header">
          <h1>{activeSession?.title ?? 'MCP Chat'}</h1>
          <div className="main-header-meta">
            {config ? (
              <span className="badge">
                <span
                  className={`badge-dot ${config.mcpConnected ? '' : 'offline'}`}
                />
                {config.mcpConnected
                  ? `${config.toolCount} tools · ${config.promptCount ?? 0} prompts · ${config.resourceCount ?? 0} resources`
                  : 'MCP offline'}
              </span>
            ) : null}
            {error ? <span style={{ color: 'var(--danger)' }}>{error}</span> : null}
          </div>
        </header>

        {activeSessionId ? (
          <ChatWindow
            messages={messages}
            isStreaming={isStreaming}
            prompts={config?.prompts ?? []}
            resources={config?.resources ?? []}
            promptCacheTtl={config?.promptCacheTtl}
            samplingPresets={samplingPresets}
            samplingPreset={samplingPreset}
            onSamplingPresetChange={setSamplingPreset}
            onSend={(text) => void handleSend(text)}
          />
        ) : (
          <div className="empty-state">
            <h2>Welcome</h2>
            <p>Start a new chat to talk to Claude with MCP tools.</p>
          </div>
        )}
      </main>
    </div>
  );
}
