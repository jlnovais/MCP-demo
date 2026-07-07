import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function parseBasicCredentials(
  header: string,
): { username: string; password: string } | null {
  if (!header.startsWith('Basic ')) {
    return null;
  }

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }
    return {
      username: decoded.slice(0, colonIndex),
      password: decoded.slice(colonIndex + 1),
    };
  } catch {
    return null;
  }
}

function requestCredentials(res: Response): void {
  res.setHeader('WWW-Authenticate', 'Basic realm="MCP Chat"');
  res.status(401).send('Authentication required');
}

export function createBasicAuthMiddleware(
  expectedUsername: string,
  expectedPassword: string,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const credentials = parseBasicCredentials(req.headers.authorization ?? '');
    if (
      !credentials ||
      !constantTimeEqual(credentials.username, expectedUsername) ||
      !constantTimeEqual(credentials.password, expectedPassword)
    ) {
      requestCredentials(res);
      return;
    }
    next();
  };
}
