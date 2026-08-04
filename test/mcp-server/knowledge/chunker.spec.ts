import { beforeEach, describe, expect, it } from '@jest/globals';
import { Document } from 'llamaindex';
import {
  createNodeParser,
  resolveChunker,
  resolveChunkerForFile,
  resolveFileType,
  splitDocumentText,
} from '../../../apps/mcp-server/src/mcp/knowledge/chunker';

const FAQ = `# Wallet FAQ

## How do transfers work?

A transfer moves credits from a source wallet to a destination wallet.

## Can a balance go negative?

No. Credit balances are always zero or positive.

## Refund policy

Refunds are performed as a transfer of credits back from the merchant to the user.
`;

const HTML_FIXTURE = `<html><head><title>T</title><style>.x{}</style></head>
<body><h1>Refunds</h1><p>Credits go back to the <b>user</b>.</p>
<script>alert(1)</script></body></html>`;

describe('knowledge chunker', () => {
  describe('resolveChunker', () => {
    it('defaults to sentence', () => {
      expect(resolveChunker()).toBe('sentence');
      expect(resolveChunker(undefined, undefined)).toBe('sentence');
      expect(resolveChunker(null, '')).toBe('sentence');
    });

    it('prefers explicit over env', () => {
      expect(resolveChunker('markdown', 'sentence')).toBe('markdown');
    });

    it('reads env when explicit is omitted', () => {
      expect(resolveChunker(undefined, 'markdown')).toBe('markdown');
    });

    it('accepts html', () => {
      expect(resolveChunker('html')).toBe('html');
    });

    it('rejects unknown values', () => {
      expect(() => resolveChunker('tokens')).toThrow(/Unsupported chunker/);
    });
  });

  describe('resolveFileType', () => {
    it('maps extensions to knowledge file types', () => {
      expect(resolveFileType('notes.txt')).toBe('text');
      expect(resolveFileType('page.html')).toBe('html');
      expect(resolveFileType('page.htm')).toBe('html');
      expect(resolveFileType('page.HTML')).toBe('html');
      expect(resolveFileType('faq.md')).toBe('markdown');
      expect(resolveFileType('faq.markdown')).toBe('markdown');
      expect(resolveFileType('guide.pdf')).toBe('pdf');
      expect(resolveFileType('other.csv')).toBeUndefined();
    });
  });

  describe('resolveChunkerForFile', () => {
    const config = {
      default: 'sentence',
      text: 'sentence',
      html: 'html',
      markdown: 'markdown',
      pdf: 'sentence',
    };

    it('uses type-specific env when set', () => {
      expect(resolveChunkerForFile('faq.md', config)).toBe('markdown');
      expect(resolveChunkerForFile('page.html', config)).toBe('html');
      expect(resolveChunkerForFile('notes.txt', config)).toBe('sentence');
      expect(resolveChunkerForFile('guide.pdf', config)).toBe('sentence');
    });

    it('falls back to default when type env is empty', () => {
      expect(
        resolveChunkerForFile('faq.md', {
          default: 'sentence',
          markdown: '',
        }),
      ).toBe('sentence');
      expect(
        resolveChunkerForFile('faq.md', {
          default: 'html',
          markdown: undefined,
        }),
      ).toBe('html');
    });

    it('CLI override wins over type env', () => {
      expect(resolveChunkerForFile('faq.md', config, 'sentence')).toBe(
        'sentence',
      );
      expect(resolveChunkerForFile('page.html', config, 'markdown')).toBe(
        'markdown',
      );
    });

    it('uses default for unknown extensions', () => {
      expect(resolveChunkerForFile('data.csv', { default: 'markdown' })).toBe(
        'markdown',
      );
    });
  });

  describe('splitDocumentText', () => {
    let document: Document;

    beforeEach(() => {
      document = new Document({
        text: FAQ,
        metadata: { source: 'wallet-faq.md' },
      });
    });

    it('splits markdown FAQs by headers', async () => {
      const chunks = await splitDocumentText(
        createNodeParser('markdown'),
        document,
      );

      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks.some((c) => /transfers work/i.test(c))).toBe(true);
      expect(chunks.some((c) => /Refund policy/i.test(c))).toBe(true);
      expect(chunks.every((c) => c.length < FAQ.length)).toBe(true);
    });

    it('keeps short FAQs as fewer sentence chunks than markdown sections', async () => {
      const sentence = await splitDocumentText(
        createNodeParser('sentence'),
        document,
      );
      const markdown = await splitDocumentText(
        createNodeParser('markdown'),
        document,
      );

      expect(sentence.length).toBeGreaterThan(0);
      expect(markdown.length).toBeGreaterThan(sentence.length);
    });

    it('strips HTML tags with the html chunker', async () => {
      const chunks = await splitDocumentText(
        createNodeParser('html'),
        new Document({ text: HTML_FIXTURE, metadata: { source: 'x.html' } }),
      );

      expect(chunks.length).toBeGreaterThan(0);
      const joined = chunks.join('\n');
      expect(joined).toMatch(/Credits go back to the user/i);
      expect(joined).not.toMatch(/<h1>|<p>|<script>|alert\(/i);
    });
  });
});
