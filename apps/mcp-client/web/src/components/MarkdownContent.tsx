import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartBlock, parseChartSpec } from './ChartBlock';
import './MarkdownContent.css';

type MarkdownContentProps = {
  children: string;
  className?: string;
};

function getCodeText(children: ReactNode): string {
  return String(children).replace(/\n$/, '');
}

export function MarkdownContent({ children, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children: preChildren }) {
            const codeChild = Array.isArray(preChildren)
              ? preChildren[0]
              : preChildren;

            if (
              isValidElement<{ className?: string; children?: ReactNode }>(
                codeChild,
              ) &&
              (codeChild.props.className ?? '').includes('language-chart')
            ) {
              const raw = getCodeText(codeChild.props.children);
              const spec = parseChartSpec(raw);
              if (spec) {
                return <ChartBlock spec={spec} />;
              }
            }

            return <pre>{preChildren}</pre>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
