import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartBlock, parseChartSpec } from './ChartBlock';
import {
  PaymentsReportBlock,
  parsePaymentsReportSpec,
} from './PaymentsReportBlock';
import {
  WalletSummaryBlock,
  parseWalletSummarySpec,
} from './WalletSummaryBlock';
import './MarkdownContent.css';

type MarkdownContentProps = {
  children: string;
  className?: string;
};

function getCodeText(children: ReactNode): string {
  return String(children).replace(/\n$/, '');
}

export function MarkdownContent({
  children,
  className = '',
}: MarkdownContentProps) {
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
              )
            ) {
              const classNameProp = codeChild.props.className ?? '';
              const raw = getCodeText(codeChild.props.children);

              if (classNameProp.includes('language-chart')) {
                const spec = parseChartSpec(raw);
                if (spec) {
                  return <ChartBlock spec={spec} />;
                }
              }

              if (classNameProp.includes('language-wallet_summary')) {
                const spec = parseWalletSummarySpec(raw);
                if (spec) {
                  return <WalletSummaryBlock spec={spec} />;
                }
              }

              if (classNameProp.includes('language-payments_report')) {
                const spec = parsePaymentsReportSpec(raw);
                if (spec) {
                  return <PaymentsReportBlock spec={spec} />;
                }
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
