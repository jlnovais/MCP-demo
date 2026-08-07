import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.html', '.htm']);

const URI_PREFIX = 'wallet://docs/';

type DocFile = {
  /** Filename including extension, used as the URI `{name}` segment. */
  name: string;
  absolutePath: string;
  mimeType: string;
};

function mimeTypeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    return 'text/html';
  }
  if (ext === '.txt') {
    return 'text/plain';
  }
  return 'text/markdown';
}

/**
 * Resolve the knowledge directory. Prefer `KNOWLEDGE_DIR`, then
 * `cwd/knowledge` (Nest starts from `apps/mcp-server`), then a path relative
 * to this compiled module under the monorepo root.
 */
export async function resolveKnowledgeDir(): Promise<string> {
  const fromEnv = process.env.KNOWLEDGE_DIR?.trim();
  const candidates = [
    fromEnv ? path.resolve(fromEnv) : undefined,
    path.join(process.cwd(), 'knowledge'),
    // dist/apps/mcp-server/mcp/tools → repo root → apps/mcp-server/knowledge
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'apps',
      'mcp-server',
      'knowledge',
    ),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      // try next
    }
  }

  return path.join(process.cwd(), 'knowledge');
}

async function listDocFiles(knowledgeDir: string): Promise<DocFile[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(knowledgeDir);
  } catch {
    return [];
  }

  const docs: DocFile[] = [];
  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      continue;
    }
    if (entry.includes('/') || entry.includes('\\') || entry.includes('..')) {
      continue;
    }
    const absolutePath = path.join(knowledgeDir, entry);
    try {
      const stat = await fs.stat(absolutePath);
      if (!stat.isFile()) {
        continue;
      }
    } catch {
      continue;
    }
    docs.push({
      name: entry,
      absolutePath,
      mimeType: mimeTypeFor(entry),
    });
  }

  docs.sort((a, b) => a.name.localeCompare(b.name));
  return docs;
}

function resolveDocPath(
  knowledgeDir: string,
  name: string,
): string | undefined {
  if (
    !name ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('..') ||
    path.isAbsolute(name)
  ) {
    return undefined;
  }

  const ext = path.extname(name).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    return undefined;
  }

  const absolutePath = path.resolve(knowledgeDir, name);
  const relative = path.relative(knowledgeDir, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return undefined;
  }

  return absolutePath;
}

export function registerKnowledgeResources(server: McpServer): void {
  const template = new ResourceTemplate(`${URI_PREFIX}{name}`, {
    list: async () => {
      const knowledgeDir = await resolveKnowledgeDir();
      const docs = await listDocFiles(knowledgeDir);
      return {
        resources: docs.map((doc) => ({
          uri: `${URI_PREFIX}${doc.name}`,
          name: doc.name,
          title: doc.name,
          description: `Knowledge base document: ${doc.name}`,
          mimeType: doc.mimeType,
        })),
      };
    },
    complete: {
      name: async (value) => {
        const knowledgeDir = await resolveKnowledgeDir();
        const docs = await listDocFiles(knowledgeDir);
        const prefix = value.toLowerCase();
        return docs
          .map((doc) => doc.name)
          .filter((name) => name.toLowerCase().startsWith(prefix));
      },
    },
  });

  server.registerResource(
    'knowledge_docs',
    template,
    {
      title: 'Wallet / Mindshaker knowledge docs',
      description:
        'Read-only knowledge base files (markdown, text, HTML) under apps/mcp-server/knowledge. Use wallet://docs/{filename} URIs.',
      mimeType: 'text/markdown',
    },
    async (uri, variables) => {
      const rawName = variables.name;
      const name = Array.isArray(rawName) ? rawName[0] : rawName;
      if (typeof name !== 'string' || !name.trim()) {
        throw new Error('Resource name is required');
      }

      const knowledgeDir = await resolveKnowledgeDir();
      const absolutePath = resolveDocPath(knowledgeDir, name.trim());
      if (!absolutePath) {
        throw new Error(`Invalid or unsupported resource name: ${name}`);
      }

      let text: string;
      try {
        text = await fs.readFile(absolutePath, 'utf8');
      } catch {
        throw new Error(`Knowledge document not found: ${name}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: mimeTypeFor(name),
            text,
          },
        ],
      };
    },
  );
}
