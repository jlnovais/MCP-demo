import type {
  ChatStreamEvent,
  ServerConfig,
  SessionDetail,
  SessionSummary,
} from './types';

const API_BASE = '/api';

const fetchOptions: RequestInit = { credentials: 'same-origin' };

function getErrorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return body.error;
  }
  return fallback;
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  return getErrorMessage(body, fallback);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...fetchOptions,
    ...init,
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Request failed (${response.status})`),
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function fetchConfig(): Promise<ServerConfig> {
  return request<ServerConfig>('/config');
}

export function fetchSessions(): Promise<SessionSummary[]> {
  return request<SessionSummary[]>('/sessions');
}

export function createSession(): Promise<SessionDetail> {
  return request<SessionDetail>('/sessions', { method: 'POST' });
}

export function fetchSession(id: string): Promise<SessionDetail> {
  return request<SessionDetail>(`/sessions/${id}`);
}

export function deleteSession(id: string): Promise<void> {
  return request<void>(`/sessions/${id}`, { method: 'DELETE' });
}

export async function streamChat(
  sessionId: string,
  message: string,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/chat`, {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Chat failed (${response.status})`),
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response stream');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue;
      }
      const payload = line.slice(6).trim();
      if (!payload) {
        continue;
      }
      onEvent(JSON.parse(payload) as ChatStreamEvent);
    }
  }
}
