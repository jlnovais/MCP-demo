import type { ServerConfig, SessionSummary } from '../types';
import './Sidebar.css';

type SidebarProps = {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  config: ServerConfig | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
};

export function Sidebar({
  sessions,
  activeSessionId,
  config,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">M</div>
          <div>
            <h2>MCP Chat</h2>
            <p>{config?.model ?? 'Loading…'}</p>
          </div>
        </div>
        <button type="button" className="new-chat-btn" onClick={onNewChat}>
          <span>+</span>
          <span>New chat</span>
        </button>
      </div>

      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="session-empty">No conversations yet</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
            >
              <button
                type="button"
                className="session-item-select"
                onClick={() => onSelectSession(session.id)}
              >
                <span className="session-item-title">{session.title}</span>
              </button>
              <button
                type="button"
                className="session-delete"
                aria-label="Delete chat"
                onClick={() => onDeleteSession(session.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
